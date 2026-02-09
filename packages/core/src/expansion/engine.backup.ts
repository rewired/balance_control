import { z, type ZodTypeAny } from 'zod';
import { pruneExpiredEffects } from '../effects';
import { resetMeasureRoundFlags } from '../measures/helpers';
import type { ActionEnvelope, GameConfig, GameSnapshot, PlacedTile, ResourceDef } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';
import { generateSupplyTiles } from '../supply';
import { coordKey, isAdjacentToAny } from '../coord';

export type EngineErrorCode =
  | 'UNKNOWN_ACTION'
  | 'VALIDATION_ERROR'
  | 'ACTION_SCHEMA_NOT_REGISTERED'
  | 'EXPANSION_NOT_ENABLED'
  | 'NOT_ACTIVE_PLAYER'
  | 'CELL_OCCUPIED'
  | 'DUPLICATE_TILE_ID'
  | 'SUPPLY_EMPTY'
  | 'HAND_FULL'
  | 'TILE_NOT_IN_HAND'
  | 'WRONG_TURN_PHASE'
  | 'PLACEMENT_ALREADY_DONE'
  | 'ACTION_NOT_ALLOWED_IN_PHASE'
  | 'HOOK_REJECTED'
  | 'DUPLICATE_RESOURCE_ID'
  | 'TILE_NOT_FOUND'
  | 'INFLUENCE_CAP_REACHED'
  | 'INSUFFICIENT_INFLUENCE';

export interface Engine {
  registries: EngineRegistries;
  createInitialSnapshot(
    config: (GameConfig & { sessionId: string }) & { players?: Array<{ id: string; name?: string }> }
  ): GameSnapshot;
  applyAction(
    snapshot: GameSnapshot,
    action: ActionEnvelope
  ):
    | { ok: true; next: GameSnapshot; events: Array<{ id: string; at: number; kind: string; message: string }> }
    | { ok: false; error: { code: EngineErrorCode; message: string; details?: unknown } };
}

export function createEngine(options: EngineOptions): Engine {\n  const registries = buildEngineRegistries(options);\n  const defaultIsGloballyPlaceable = (state: any, _tile: any) => true;\n  const defaultIsPlacementLegal = (state: any, _tile: any, coord: { q: number; r: number }) => { const board = state.board as { cells: Array<{ key: string }> }; if (board.cells.length === 0) return true; const occ = new Set(board.cells.map((c:any)=>c.key)); return isAdjacentToAny(coord, occ); };\n  const isGloballyPlaceable = options.isTileGloballyPlaceable ?? defaultIsGloballyPlaceable;\n  const isPlacementLegal = options.isPlacementLegal ?? defaultIsPlacementLegal;

  // Base resource definitions (session-scoped)
  const baseResources: ResourceDef[] = [
    { id: 'domestic', label: 'Domestic' },
    { id: 'foreign', label: 'Foreign' },
    { id: 'media', label: 'Media' },
  ];

  // Register core action schemas (immutable)
  registries.actions.set('core.noop', { type: 'core.noop', payload: z.unknown() as unknown as ZodTypeAny });
  registries.actions.set('core.passTurn', { type: 'core.passTurn', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeTile', {\n    type: 'core.placeTile',\n    payload: z.object({ coord: z.object({ q: z.number().int(), r: z.number().int() }) }) as ZodTypeAny,\n  });
  registries.actions.set('core.drawTile', { type: 'core.drawTile', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeInfluence', {
    type: 'core.placeInfluence',
    payload: z.object({ coord: z.object({ q: z.number().int(), r: z.number().int() }), amount: z.literal(1) }) as ZodTypeAny,
  });
  registries.actions.set('core.moveInfluence', {
    type: 'core.moveInfluence',
    payload: z.object({
      from: z.object({ q: z.number().int(), r: z.number().int() }),
      to: z.object({ q: z.number().int(), r: z.number().int() }),
      amount: z.literal(1),
    }) as ZodTypeAny,
  });

  function createInitialSnapshot(
    config: (GameConfig & { sessionId: string }) & { players?: Array<{ id: string; name?: string }> }
  ): GameSnapshot {
    const now = Date.now();
    const players = (config.players ?? []).map((p, i) => ({ id: p.id, name: p.name, index: i }));
    const tiles = generateSupplyTiles({ seed: config.seed ?? 'seed' });
        let drawIndex = 0;}
    const resourcesRegistry: ResourceDef[] = (() => {
      const m = new Map<string, ResourceDef>();
      for (const r of baseResources) m.set(r.id, r);
      for (const expId of (config.enabledExpansions ?? [])) {
        const defs = registries.resourceDefProviders.get(expId) ?? [];
        for (const d of defs) {
          if (m.has(d.id)) {
            // Strict duplicate guard: session creation must fail deterministically
            throw new Error(`DUPLICATE_RESOURCE_ID:${d.id}`);
          }
          m.set(d.id, d);
        }
      }
      return [...m.values()].sort((a,b)=>a.id.localeCompare(b.id));
    })();
    const pools: Record<string, Record<string, number>> = Object.fromEntries(
      players.map(p => [p.id, Object.fromEntries(resourcesRegistry.map(r => [r.id, 0]))])
    );
    let snapshot: GameSnapshot = {
      sessionId: config.sessionId,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [], seed: config.seed ?? 'seed' },
      state: {
        players,
        activePlayerIndex: 0,
        activePlayerId: players[0]?.id,
        phase: 'awaitingPlacement', round: 1, turnInRound: 1, roundStartPlayerIndex: 0,
        turn: 1,
        board: { cells: [] },
        resources: { registry: resourcesRegistry },
        resourcesByPlayerId: pools,
        influenceByCoord: {},
        supply: { tiles, drawIndex },
        hands: handsInit,
        effects: [],
        extensions: {},
      },
      log: [],
    };
    for (const id of snapshot.config.enabledExpansions) { const init = registries.stateInitializers.get(id); if (init) (snapshot.state.extensions as Record<string, unknown>)[id] = init(); }
    for (const h of registries.hooks.onSessionCreate) { try { const maybe = (h as any)(snapshot); if (maybe && typeof maybe === 'object' && 'state' in maybe) { snapshot = GameSnapshotSchema.parse(maybe); } } catch {} }
    return snapshot;
  }

  function applyAction(snapshot: GameSnapshot, action: ActionEnvelope) {
    const schema = registries.actions.get(action.type);
    if (!schema) { return { ok: false as const, error: { code: 'ACTION_SCHEMA_NOT_REGISTERED' as EngineErrorCode, message: `Unregistered action type: ${action.type}` } }; }
    const req = (schema as { requiresExpansionId?: string }).requiresExpansionId; if (req && !snapshot.config.enabledExpansions.includes(req)) { return { ok: false as const, error: { code: 'EXPANSION_NOT_ENABLED' as EngineErrorCode, message: `Expansion not enabled: ${req}` } }; }
    for (const h of registries.hooks.onBeforeActionValidate) { try { (h as any)(snapshot, action); } catch {} }
    const parsed = (schema as { payload: ZodTypeAny }).payload.safeParse(action.payload); if (!parsed.success) { return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'Invalid payload', details: parsed.error.flatten() } }; }
    if (action.type === 'core.noop') { const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' }; const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] }; GameSnapshotSchema.parse(next); return { ok: true as const, next, events: [entry] }; }
    const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>; const activeIndex = snapshot.state.activePlayerIndex as number; const active = players[activeIndex]; if (!active) { return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } }; } if (action.actorId !== active.id) { return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Actor is not the active player' } }; }
    const phase = (snapshot.state as { phase: 'awaitingPlacement' | 'awaitingAction' | 'awaitingPass' }).phase as 'awaitingPlacement' | 'awaitingAction' | 'awaitingPass';
    { const eff = ((snapshot.state as any).effects ?? []) as any[]; const filtered = eff.filter((e:any) => !e.ownerPlayerId || e.ownerPlayerId === action.actorId); const hookSnap = { ...snapshot, state: { ...(snapshot.state as any), effects: filtered } } as GameSnapshot; for (const h of registries.hooks.onValidateAction) { try { const r = (h as any)(hookSnap, action); if (r && r.reject) { return { ok: false as const, error: r.reject }; } } catch {} } }

    if (action.type === 'core.passTurn') {
      if (phase !== 'awaitingPass') { return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Pass is only allowed in awaitingPass' } }; }
      const nextIndex = (activeIndex + 1) % players.length; const round = (snapshot.state as any).round ?? 1; const turnInRound = (snapshot.state as any).turnInRound ?? 1; const roundStartPlayerIndex = (snapshot.state as any).roundStartPlayerIndex ?? 0; const wrapped = nextIndex === roundStartPlayerIndex; const nextRound = wrapped ? (round + 1) : round; const nextTurnInRound = wrapped ? 1 : (turnInRound + 1);
      const at = Date.now(); const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> }; const sorted = [...board.cells].sort((a,b)=>a.key.localeCompare(b.key)); const totals: Record<string, number> = {}; let tileCount = 0; for (const cell of sorted) { if (cell.tile.placedBy === active.id) { tileCount++; const prod = (cell.tile.tile as { production?: Record<string, number> }).production; if (prod) { for (const [rid, amt] of Object.entries(prod)) { totals[rid] = (totals[rid] ?? 0) + (amt ?? 0); } } } }
      const pools = (snapshot.state.resourcesByPlayerId as Record<string, Record<string, number>>) ?? {}; const current = { ...(pools[active.id] ?? {}) }; for (const [rid, amt] of Object.entries(totals)) { current[rid] = (current[rid] ?? 0) + amt; }
      const resEntry = { id: action.actionId + ':res', at, kind: 'resourceResolution', message: `${active.name ?? active.id} resources resolved`, payload: { playerId: active.id, delta: totals, tileCount } };
      const passEntry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} ended their turn` };
      const aboutToBeActiveId = players[nextIndex]?.id;
      // Round reset: when round increments, clear per-round measure flags on all extensions that expose measures.
      let newState: any = { ...snapshot.state, resourcesByPlayerId: { ...pools, [active.id]: current }, activePlayerIndex: nextIndex, activePlayerId: players[nextIndex]?.id, phase: 'awaitingPlacement', round: nextRound, turnInRound: nextTurnInRound, roundStartPlayerIndex, turn: (snapshot.state.turn as number) + 1 };
      if (nextRound !== (snapshot.state as any).round) {
        const exts = { ...(newState.extensions ?? {}) } as Record<string, any>;
        for (const k of Object.keys(exts).sort()) {
          const ext = exts[k];
          if (ext && typeof ext === 'object' && ext.measures && typeof ext.measures === 'object') {
            ext.measures = resetMeasureRoundFlags(ext.measures);
          }
        }
        newState = { ...newState, extensions: exts };
      }
      const prunedState = pruneExpiredEffects(newState, aboutToBeActiveId);
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: prunedState, log: [...snapshot.log, resEntry, passEntry] };
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [resEntry, passEntry, ...extraEvents] };
    }

    if (action.type === 'core.drawTile') {\n      if (phase !== 'awaitingPlacement') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Draw only allowed at turn start' } }; }\n      const supply = snapshot.state.supply as { tiles: Array<{ id: string; kind: string; production: Record<string, number> }>; drawIndex: number; openDiscard: Array<{ id: string; kind: string; production: Record<string, number> }> };\n      let drawIndex = supply.drawIndex;\n      let pending: { id: string; kind: string; production: Record<string, number> } | null = null;\n      const occupied = new Set(((snapshot.state.board as { cells: Array<{ key: string }>}).cells).map(c => c.key));\n      while (drawIndex < supply.tiles.length) {\n        const t = supply.tiles[drawIndex]!;\n        // Check global placeability: if board is empty, always placeable; else must have some adjacent empty spot
        const hasAny = ((snapshot.state.board as { cells: Array<{ key: string }>}).cells.length === 0) ? true : true; // adjacency check at placement time; assume potentially placeable
        if (hasAny) { pending = t; drawIndex++; break; }\n        // Not placeable anywhere per rules -> open discard and continue
        drawIndex++;\n        const atd = Date.now();\n        const discardEntry = { id: action.actionId + ':discard:' + drawIndex, at: atd, kind: 'core.discardUnplaceable', message: Discarded unplaceable tile  };\n        // Log discard via events; snapshot log records only draw event below
      }\n      const at = Date.now();\n      if (!pending) {\n        // Supply exhausted -> 7.1 entfällt; move to awaitingAction
        const entry = { id: action.actionId, at, kind: action.type, message: ${active.name ?? active.id} found no placeable tile (supply empty) };\n        const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...snapshot.state, supply: { ...supply, drawIndex }, pendingPlacementTile: null, phase: 'awaitingAction' }, log: [...snapshot.log, entry] };\n        for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);\n        const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }\n        let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }\n        return { ok: true as const, next: finalNext, events: [{ id: action.actionId + ':s', at, kind: action.type, message: 'Supply exhausted at draw' }, ...extraEvents] };\n      } else {\n        const entry = { id: action.actionId, at, kind: action.type, message: ${active.name ?? active.id} drew a tile for placement };\n        const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...snapshot.state, supply: { ...supply, drawIndex }, pendingPlacementTile: pending }, log: [...snapshot.log, entry] };\n        for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);\n        const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }\n        let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }\n        return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };\n      }\n    }\n\n    if (action.type === 'core.placeTile') {\n      if (phase !== 'awaitingPlacement') { return { ok: false as const, error: { code: 'PLACEMENT_ALREADY_DONE' as EngineErrorCode, message: 'Placement already performed this turn' } }; }\n      const payload = action.payload as { coord: { q: number; r: number } }; const key = ${payload.coord.q},; const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };\n      if (board.cells.some((c) => c.key === key)) { return { ok: false as const, error: { code: 'CELL_OCCUPIED' as EngineErrorCode, message: 'Target cell is occupied' } }; }\n      const pending = (snapshot.state as any).pendingPlacementTile as { id: string; kind: string; production: Record<string, number> } | null;\n      if (!pending) { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'No drawn tile to place' } }; }\n      // Enforce adjacency: if board empty, allow anywhere; else coord must touch an existing tile
      const occupied = new Set(board.cells.map(c => c.key));\n      const boardEmpty = board.cells.length === 0;\n      if (!boardEmpty) { if (!isAdjacentToAny(payload.coord, occupied)) { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Placement must be adjacent' } }; } }\n      if (board.cells.some((c) => c.tile.tile.id === pending.id)) { return { ok: false as const, error: { code: 'DUPLICATE_TILE_ID' as EngineErrorCode, message: 'Tile id already placed' } }; }\n      const placed = { tile: pending, coord: payload.coord, placedBy: action.actorId, placedAtTurn: snapshot.state.turn as number };\n      const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: ${active.name ?? active.id} placed tile  at (,) };\n      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...snapshot.state, board: { cells: [...board.cells, { key, tile: placed }] }, pendingPlacementTile: null, phase: 'awaitingAction' }, log: [...snapshot.log, entry] } as GameSnapshot;\n      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);\n      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }\n      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }\n      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };\n    }\n\n    if (action.type === 'core.placeInfluence') {
      if (phase !== 'awaitingAction') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence placement only allowed after placement' } }; }
      const payload = action.payload as { coord: { q: number; r: number }; amount: 1 }; const key = `${payload.coord.q},${payload.coord.r}`; const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> }; if (!board.cells.some(c => c.key === key)) { return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'No tile at coord' } }; }
      const inf = { ...(snapshot.state.influenceByCoord as Record<string, Record<string, number>> ) }; const per = { ...(inf[key] ?? {}) }; const cur = (per[active.id] ?? 0); if (cur + 1 > 3) { return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached' } }; }
      per[active.id] = cur + 1; inf[key] = per; const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} placed influence at (${payload.coord.q},${payload.coord.r})` };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...snapshot.state, influenceByCoord: inf, phase: 'awaitingPass' as const }, log: [...snapshot.log, entry] };
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
    }

    if (action.type === 'core.moveInfluence') {
      if (phase !== 'awaitingAction') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence move only allowed after placement' } }; }
      const payload = action.payload as { from: { q: number; r: number }; to: { q: number; r: number }; amount: 1 }; const fromKey = `${payload.from.q},${payload.from.r}`; const toKey = `${payload.to.q},${payload.to.r}`; const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> }; if (!board.cells.some(c => c.key === fromKey) || !board.cells.some(c => c.key === toKey)) { return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'Tile not found' } }; }
      const inf = { ...(snapshot.state.influenceByCoord as Record<string, Record<string, number>> ) }; const fromPer = { ...(inf[fromKey] ?? {}) }; const toPer = { ...(inf[toKey] ?? {}) }; const fromCur = fromPer[active.id] ?? 0; if (fromCur < 1) { return { ok: false as const, error: { code: 'INSUFFICIENT_INFLUENCE' as EngineErrorCode, message: 'Not enough influence at source' } }; } const toCur = toPer[active.id] ?? 0; if (toCur + 1 > 3) { return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached at destination' } }; }
      fromPer[active.id] = fromCur - 1; if (fromPer[active.id] === 0) { delete fromPer[active.id]; } toPer[active.id] = toCur + 1; inf[fromKey] = fromPer; inf[toKey] = toPer; const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} moved influence from (${payload.from.q},${payload.from.r}) to (${payload.to.q},${payload.to.r})` };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...snapshot.state, influenceByCoord: inf, phase: 'awaitingPass' as const }, log: [...snapshot.log, entry] };
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
    }

    if (phase === 'awaitingPlacement') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Only placement allowed at turn start' } }; }
    if (phase === 'awaitingPass' && action.type !== 'core.passTurn') { return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Only pass allowed now' } }; }
    for (const reducer of registries.reducers) { const res = reducer(snapshot, action); if (res) { const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: 'Action applied' }; const nextState = (phase === 'awaitingAction' && action.type !== 'core.passTurn') ? { ...res.next.state, phase: 'awaitingPass' as const } : res.next.state; const next = { ...res.next, state: nextState, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] } as GameSnapshot; for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} } GameSnapshotSchema.parse(next); const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} } let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} } return { ok: true as const, next: finalNext, events: [entry, ...(res.events ?? []), ...extraEvents] }; } }
    return { ok: false as const, error: { code: 'UNKNOWN_ACTION' as EngineErrorCode, message: `No reducer handled action: ${action.type}` } };
  }

  return { registries, createInitialSnapshot, applyAction };
}
