import { z, type ZodTypeAny } from 'zod';
import { pruneExpiredEffects } from '../effects';
import { resetMeasureRoundFlags } from '../measures/helpers';
import type { ActionEnvelope, GameConfig, GameSnapshot, PlacedTile, ResourceDef } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';
import { generateSupplyTiles } from '../supply';
import { isAdjacentToAny } from '../coord';

export type EngineErrorCode =
  | 'UNKNOWN_ACTION'
  | 'VALIDATION_ERROR'
  | 'ACTION_SCHEMA_NOT_REGISTERED'
  | 'EXPANSION_NOT_ENABLED'
  | 'NOT_ACTIVE_PLAYER'
  | 'CELL_OCCUPIED'
  | 'DUPLICATE_TILE_ID'
  | 'SUPPLY_EMPTY'
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

export function createEngine(options: EngineOptions): Engine {
  const registries = buildEngineRegistries(options);

  const isTileGloballyPlaceable = options.isTileGloballyPlaceable ?? (() => true);
  const isPlacementLegal = options.isPlacementLegal ?? ((state: any, _tile: any, coord: { q: number; r: number }) => {
    const board = (state as any).board as { cells: Array<{ key: string }> };
    if (board.cells.length === 0) return true;
    const occupied = new Set(board.cells.map((c) => c.key));
    return isAdjacentToAny(coord, occupied);
  });

  const baseResources: ResourceDef[] = [
    { id: 'domestic', label: 'Domestic' },
    { id: 'foreign', label: 'Foreign' },
    { id: 'media', label: 'Media' },
  ];

  registries.actions.set('core.noop', { type: 'core.noop', payload: z.unknown() as unknown as ZodTypeAny });
  registries.actions.set('core.passTurn', { type: 'core.passTurn', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeTile', { type: 'core.placeTile', payload: z.object({ coord: z.object({ q: z.number().int(), r: z.number().int() }) }).strict() as ZodTypeAny });
  registries.actions.set('core.drawTile', { type: 'core.drawTile', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeInfluence', { type: 'core.placeInfluence', payload: z.object({ coord: z.object({ q: z.number().int(), r: z.number().int() }), amount: z.literal(1) }) as ZodTypeAny });
  registries.actions.set('core.moveInfluence', { type: 'core.moveInfluence', payload: z.object({ from: z.object({ q: z.number().int(), r: z.number().int() }), to: z.object({ q: z.number().int(), r: z.number().int() }), amount: z.literal(1) }) as ZodTypeAny });

  function createInitialSnapshot(
    config: (GameConfig & { sessionId: string }) & { players?: Array<{ id: string; name?: string }> }
  ): GameSnapshot {
    const now = Date.now();
    const players = (config.players ?? []).map((p, i) => ({ id: p.id, name: p.name, index: i }));
    const tiles = generateSupplyTiles({ seed: config.seed ?? 'seed' });

    const resourcesRegistry: ResourceDef[] = (() => {
      const m = new Map<string, ResourceDef>();
      for (const r of baseResources) m.set(r.id, r);
      for (const expId of (config.enabledExpansions ?? [])) {
        const defs = registries.resourceDefProviders.get(expId) ?? [];
        for (const d of defs) {
          if (m.has(d.id)) throw new Error(`DUPLICATE_RESOURCE_ID:${d.id}`);
          m.set(d.id, d);
        }
      }
      return [...m.values()].sort((a, b) => a.id.localeCompare(b.id));
    })();

    const pools: Record<string, Record<string, number>> = Object.fromEntries(
      players.map((p) => [p.id, Object.fromEntries(resourcesRegistry.map((r) => [r.id, 0]))])
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
        phase: 'awaitingPlacement',
        round: 1,
        turnInRound: 1,
        roundStartPlayerIndex: 0,
        turn: 1,
        board: { cells: [] },
        resources: { registry: resourcesRegistry },
        resourcesByPlayerId: pools,
        influenceByCoord: {},
        supply: { tiles, drawIndex: 0, openDiscard: [] },
        pendingPlacementTile: null,
        effects: [],
        extensions: {},
      },
      log: [],
    };

    for (const id of snapshot.config.enabledExpansions) {
      const init = registries.stateInitializers.get(id);
      if (init) (snapshot.state.extensions as Record<string, unknown>)[id] = init();
    }
    for (const h of registries.hooks.onSessionCreate) {
      try {
        const maybe = (h as any)(snapshot);
        if (maybe && typeof maybe === 'object' && 'state' in maybe) snapshot = GameSnapshotSchema.parse(maybe);
      } catch {}
    }
    return snapshot;
  }

  function applyAction(snapshot: GameSnapshot, action: ActionEnvelope) {
    const schema = registries.actions.get(action.type);
    if (!schema) {
      return { ok: false as const, error: { code: 'ACTION_SCHEMA_NOT_REGISTERED' as EngineErrorCode, message: `Unregistered action type: ${action.type}` } };
    }
    const req = (schema as { requiresExpansionId?: string }).requiresExpansionId;
    if (req && !snapshot.config.enabledExpansions.includes(req)) {
      return { ok: false as const, error: { code: 'EXPANSION_NOT_ENABLED' as EngineErrorCode, message: `Expansion not enabled: ${req}` } };
    }

    for (const h of registries.hooks.onBeforeActionValidate) { try { (h as any)(snapshot, action); } catch {} }
    for (const h of registries.hooks.onBeforeActionValidate) { try { (h as any)(snapshot, action); } catch {} }
    const parsed = (schema as { payload: ZodTypeAny }).payload.safeParse(action.payload);
    if (!parsed.success) { return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'Invalid payload', details: parsed.error.flatten() } } ; }
    // Allow validation hooks to reject
    for (const h of registries.hooks.onValidateAction) { try { const res = (h as any)(snapshot, action); if (res && typeof res === 'object' && (res as any).reject) { const rej = (res as any).reject as { code?: string; message?: string }; return { ok: false as const, error: { code: 'HOOK_REJECTED' as EngineErrorCode, message: rej.message ?? 'Rejected by hook' } }; } } catch {} }
    const activeIndex = (snapshot.state as any).activePlayerIndex as number;
    const active = players[activeIndex] ?? { id: 'unknown' };
    if (action.actorId !== active.id && action.type !== 'core.noop') {
      return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Only active player may act' } };
    }

    if (action.type === 'core.noop') {
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    const phase = (snapshot.state as { phase: 'awaitingPlacement' | 'awaitingAction' | 'awaitingPass' }).phase;

    if (action.type === 'core.passTurn') {
      if (phase !== 'awaitingPass') { return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Pass is only allowed in awaitingPass' } }; }
      const nextIndex = (activeIndex + 1) % players.length;
      const roundStartPlayerIndex = (snapshot.state as any).roundStartPlayerIndex as number;
      const nextTurnInRound = nextIndex === roundStartPlayerIndex ? 1 : ((snapshot.state as any).turnInRound as number) + 1;
      const nextRound = nextIndex === roundStartPlayerIndex ? ((snapshot.state as any).round as number) + 1 : (snapshot.state as any).round;
      const at = Date.now();
      const passEntry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} passed` };
      const pools = (snapshot.state as any).resourcesByPlayerId as Record<string, Record<string, number>>;
      const current = { ...(pools[active.id] ?? {}) };

      // Engine ticks: prune effects, reset per-round flags when wrapping
      let newState: any = { ...snapshot.state, resourcesByPlayerId: { ...pools, [active.id]: current }, activePlayerIndex: nextIndex, activePlayerId: players[nextIndex]?.id, phase: 'awaitingPlacement', round: nextRound, turnInRound: nextTurnInRound, roundStartPlayerIndex, turn: ((snapshot.state as any).turn as number) + 1 };
      if (nextIndex === roundStartPlayerIndex) {
        try { newState.extensions = resetMeasureRoundFlags(newState.extensions); } catch {}
      }
      const pruned = pruneExpiredEffects(newState, players[nextIndex]?.id);
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: pruned, log: [...snapshot.log, passEntry] };
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
      GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [passEntry, ...extraEvents] };
    }

    if (action.type === 'core.drawTile') {
      if (phase !== 'awaitingPlacement') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Draw only allowed at turn start' } }; }
      const supply: any = (snapshot.state as any).supply;
      let drawIndex = supply.drawIndex as number;
      let pending: { id: string; kind: string; production: Record<string, number> } | null = null;
      while (drawIndex < supply.tiles.length) {
        const t = supply.tiles[drawIndex]!;
        if (isTileGloballyPlaceable((snapshot.state as any), t)) { pending = t; drawIndex++; break; }
        // unplaceable globally -> open discard
        supply.openDiscard = [...(supply.openDiscard ?? []), t];
        drawIndex++;
      }
      const at = Date.now();
      if (!pending) {
        const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} found no placeable tile (supply empty)` };
        const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...(snapshot.state as any), supply: { ...supply, drawIndex }, pendingPlacementTile: null, phase: 'awaitingAction' }, log: [...snapshot.log, entry] } as GameSnapshot;
        for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
        GameSnapshotSchema.parse(next);
        const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
        let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
        return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
      } else {
        const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} drew a tile for placement` };
        const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...(snapshot.state as any), supply: { ...supply, drawIndex }, pendingPlacementTile: pending }, log: [...snapshot.log, entry] } as GameSnapshot;
        for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
        GameSnapshotSchema.parse(next);
        const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
        let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
        return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
      }
    }

    if (action.type === 'core.placeTile') {
      if (phase !== 'awaitingPlacement') { return { ok: false as const, error: { code: 'PLACEMENT_ALREADY_DONE' as EngineErrorCode, message: 'Placement already performed this turn' } }; }
      const payload = action.payload as { coord: { q: number; r: number } };
      const key = `${payload.coord.q},${payload.coord.r}`;
      const board = (snapshot.state as any).board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (board.cells.some((c) => c.key === key)) { return { ok: false as const, error: { code: 'CELL_OCCUPIED' as EngineErrorCode, message: 'Target cell is occupied' } }; }
      const pending = (snapshot.state as any).pendingPlacementTile as { id: string; kind: string; production: Record<string, number> } | null;
      if (!pending) { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'No drawn tile to place' } }; }
      if (!isPlacementLegal((snapshot.state as any), pending, payload.coord)) { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Illegal placement' } }; }
      if (board.cells.some((c) => c.tile.tile.id === pending.id)) { return { ok: false as const, error: { code: 'DUPLICATE_TILE_ID' as EngineErrorCode, message: 'Tile id already placed' } }; }
      const placed = { tile: pending, coord: payload.coord, placedBy: action.actorId, placedAtTurn: (snapshot.state as any).turn as number };
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} placed tile ${pending.kind} at (${payload.coord.q},${payload.coord.r})` };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...(snapshot.state as any), board: { cells: [...board.cells, { key, tile: placed }] }, pendingPlacementTile: null, phase: 'awaitingAction' }, log: [...snapshot.log, entry] } as GameSnapshot;
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
      GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
    }

    if (action.type === 'core.placeInfluence') {
      if (phase !== 'awaitingAction') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence placement only allowed after placement' } }; }
      const payload = action.payload as { coord: { q: number; r: number }; amount: 1 };
      const key = `${payload.coord.q},${payload.coord.r}`;
      const board = (snapshot.state as any).board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (!board.cells.some((c) => c.key === key)) { return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'No tile at coord' } }; }
      const inf = { ...((snapshot.state as any).influenceByCoord as Record<string, Record<string, number>>) };
      const per = { ...(inf[key] ?? {}) };
      const cur = (per[active.id] ?? 0);
      if (cur + 1 > 3) { return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached' } }; }
      per[active.id] = cur + 1; inf[key] = per;
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} placed influence at (${payload.coord.q},${payload.coord.r})` };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...(snapshot.state as any), influenceByCoord: inf, phase: 'awaitingPass' }, log: [...snapshot.log, entry] } as GameSnapshot;
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
      GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
    }

    if (action.type === 'core.moveInfluence') {
      if (phase !== 'awaitingAction') { return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence move only allowed after placement' } }; }
      const payload = action.payload as { from: { q: number; r: number }; to: { q: number; r: number }; amount: 1 };
      const fromKey = `${payload.from.q},${payload.from.r}`; const toKey = `${payload.to.q},${payload.to.r}`;
      const board = (snapshot.state as any).board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (!board.cells.some((c) => c.key === fromKey) || !board.cells.some((c) => c.key === toKey)) { return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'Tile not found' } }; }
      const inf = { ...((snapshot.state as any).influenceByCoord as Record<string, Record<string, number>>) };
      const fromPer = { ...(inf[fromKey] ?? {}) }; const toPer = { ...(inf[toKey] ?? {}) };
      const fromCur = fromPer[active.id] ?? 0; if (fromCur < 1) { return { ok: false as const, error: { code: 'INSUFFICIENT_INFLUENCE' as EngineErrorCode, message: 'Not enough influence at source' } }; }
      const toCur = toPer[active.id] ?? 0; if (toCur + 1 > 3) { return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached at destination' } }; }
      fromPer[active.id] = fromCur - 1; if (fromPer[active.id] === 0) { delete fromPer[active.id]; } toPer[active.id] = toCur + 1; inf[fromKey] = fromPer; inf[toKey] = toPer;
      const at = Date.now(); const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} moved influence from (${payload.from.q},${payload.from.r}) to (${payload.to.q},${payload.to.r})` };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: { ...(snapshot.state as any), influenceByCoord: inf, phase: 'awaitingPass' }, log: [...snapshot.log, entry] } as GameSnapshot;
      for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
      GameSnapshotSchema.parse(next);
      const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
      let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
      return { ok: true as const, next: finalNext, events: [entry, ...extraEvents] };
    }

    if (phase === 'awaitingPass' && action.type !== 'core.passTurn') { return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Only pass allowed now' } }; }

    for (const reducer of registries.reducers) {
      const res = reducer(snapshot, action);
      if (res) {
        const at = Date.now();
        const entry = { id: action.actionId, at, kind: action.type, message: 'Action applied' };
        const nextState = (phase === 'awaitingAction' && action.type !== 'core.passTurn') ? { ...res.next.state, phase: 'awaitingPass' as const } : res.next.state;
        const next = { ...res.next, state: nextState, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] } as GameSnapshot;
        for (const h of registries.hooks.onApplyAction) { try { (h as any)(next, action); } catch {} }
        GameSnapshotSchema.parse(next);
        const extraEvents: any[] = []; for (const h of registries.hooks.onAfterAction) { try { const ev = (h as any)(next, action); if (Array.isArray(ev)) extraEvents.push(...ev); } catch {} }
        let finalNext = next; for (const h of registries.hooks.onSnapshot) { try { const maybe = (h as any)(finalNext); if (maybe && typeof maybe === 'object' && 'state' in maybe) { finalNext = GameSnapshotSchema.parse(maybe); } } catch {} }
        return { ok: true as const, next: finalNext, events: [entry, ...(res.events ?? []), ...extraEvents] };
      }
    }

    return { ok: false as const, error: { code: 'UNKNOWN_ACTION' as EngineErrorCode, message: `No reducer handled action: ${action.type}` } };
  }

  return { registries, createInitialSnapshot, applyAction };
}






