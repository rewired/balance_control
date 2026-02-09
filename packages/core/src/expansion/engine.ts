import { pruneExpiredEffects } from '../effects';

import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot, PlacedTile, ResourceDef } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';
import { generateSupplyTiles } from '../supply';
import { coordKey } from '../coord';

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
  | 'ACTION_NOT_ALLOWED_IN_PHASE';

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

  // Base resource definitions (session-scoped)
  const baseResources: ResourceDef[] = [
    { id: 'domestic', label: 'Domestic' },
    { id: 'foreign', label: 'Foreign' },
    { id: 'media', label: 'Media' },
  ];

  // Register core action schemas (immutable)
  registries.actions.set('core.noop', { type: 'core.noop', payload: z.unknown() as unknown as ZodTypeAny });
  registries.actions.set('core.passTurn', { type: 'core.passTurn', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeTile', {
    type: 'core.placeTile',
    payload: z.object({
      coord: z.object({ q: z.number().int(), r: z.number().int() }),
      tileId: z.string(),
    }) as ZodTypeAny,
  });
  registries.actions.set('core.drawTile', { type: 'core.drawTile', payload: z.object({}).strict() as ZodTypeAny });
  registries.actions.set('core.placeInfluence', { type: 'core.placeInfluence', payload: z.object({ coord: z.object({ q: z.number().int(), r: z.number().int() }), amount: z.literal(1) }) as ZodTypeAny });
  registries.actions.set('core.moveInfluence', { type: 'core.moveInfluence', payload: z.object({ from: z.object({ q: z.number().int(), r: z.number().int() }), to: z.object({ q: z.number().int(), r: z.number().int() }), amount: z.literal(1) }) as ZodTypeAny });

    function createInitialSnapshot(
    config: (GameConfig & { sessionId: string }) & { players?: Array<{ id: string; name?: string }> }
  ): GameSnapshot {
    const now = Date.now();
    const players = (config.players ?? []).map((p, i) => ({ id: p.id, name: p.name, index: i }));
    // Generate deterministic supply and deal 1 tile to each player at start so turn 1 can place.
    const tiles = generateSupplyTiles({ seed: config.seed ?? 'seed' });
    const handsInit: Record<string, Array<{ id: string; kind: string; production: Record<string, number> }>> = Object.fromEntries(players.map((p) => [p.id, []]));
    let drawIndex = 0;
    for (const p of players) { const t = tiles[drawIndex]; if (t !== undefined) { (handsInit[p.id]!).push(t); drawIndex++; } }
    const resourcesRegistry: ResourceDef[] = (() => {
      const m = new Map<string, ResourceDef>();
      for (const r of baseResources) m.set(r.id, r);
      for (const expId of (config.enabledExpansions ?? [])) {
        const defs = registries.resourceDefProviders.get(expId) ?? [];
        for (const d of defs) { if (!m.has(d.id)) m.set(d.id, d); }
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
    for (const id of snapshot.config.enabledExpansions) {
      const init = registries.stateInitializers.get(id);
      if (init) (snapshot.state.extensions as Record<string, unknown>)[id] = init();
    }
    
      // Invoke generic onSessionCreate hooks; allow snapshot mutation
      for (const h of registries.hooks.onSessionCreate) {
        const hfn = h as (snap: GameSnapshot) => unknown;
        const maybe = hfn(snapshot);
        if (maybe && typeof maybe === 'object' && 'state' in maybe) { snapshot = GameSnapshotSchema.parse(maybe); }
      }
      return snapshot;
  }function applyAction(snapshot: GameSnapshot, action: ActionEnvelope) {
    const schema = registries.actions.get(action.type);
    if (!schema) {
      return {
        ok: false as const,
        error: { code: 'ACTION_SCHEMA_NOT_REGISTERED' as EngineErrorCode, message: `Unregistered action type: ${action.type}` },
      };
    }
    const req = (schema as { requiresExpansionId?: string }).requiresExpansionId;
    if (req && !snapshot.config.enabledExpansions.includes(req)) {
      return { ok: false as const, error: { code: 'EXPANSION_NOT_ENABLED' as EngineErrorCode, message: `Expansion not enabled: ${req}` } };
    }
    const parsed = (schema as { payload: ZodTypeAny }).payload.safeParse(action.payload); if (!parsed.success) { return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'Invalid payload', details: (parsed as any).error?.flatten?.() } }; }

    // onBeforeActionValidate hooks

    for (const h of registries.hooks.onBeforeActionValidate) { try { (h as any)(snapshot, action); } catch {} }

    // onValidateAction can veto

    for (const h of registries.hooks.onValidateAction) { const r = (h as any)(snapshot, action); if (r && (r as any).reject) { const rej = (r as any).reject; return { ok: false as const, error: { code: (rej.code ?? 'HOOK_REJECTED') as EngineErrorCode, message: rej.message ?? 'Rejected by hook', details: rej.details } }; } }
    }

    // Allow noop for diagnostics regardless of phase.
    if (action.type === 'core.noop') {
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;
    const activeIndex = snapshot.state.activePlayerIndex as number;
    const active = players[activeIndex];
    if (!active) {
      return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };
    }
    if (action.actorId !== active.id) {
      return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Actor is not the active player' } };
    }

    const phase = (snapshot.state as { phase: 'awaitingPlacement' | 'awaitingAction' | 'awaitingPass' }).phase as 'awaitingPlacement' | 'awaitingAction' | 'awaitingPass';

    // Core action reducers with phase gates
        if (action.type === 'core.passTurn') {
      if (phase !== 'awaitingPass') {
        return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Pass is only allowed in awaitingPass' } };
      }
      const nextIndex = (activeIndex + 1) % players.length;

      const at = Date.now();

      // Round bookkeeping

      const round = (snapshot.state as any).round ?? 1;

      const turnInRound = (snapshot.state as any).turnInRound ?? 1;

      const roundStartPlayerIndex = (snapshot.state as any).roundStartPlayerIndex ?? 0;

      const wrapped = nextIndex === roundStartPlayerIndex;

      const nextRound = wrapped ? (round + 1) : round;

      const nextTir = wrapped ? 1 : (turnInRound + 1);
      // Deterministic resource resolution for the passing player
      const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };
      const sorted = [...board.cells].sort((a,b)=>a.key.localeCompare(b.key));
      const totals: Record<string, number> = {};
      let tileCount = 0;
      for (const cell of sorted) {
        if (cell.tile.placedBy === active.id) {
          tileCount++;
          const prod = (cell.tile.tile as { production?: Record<string, number> }).production;
          if (prod) {
            for (const [rid, amt] of Object.entries(prod)) {
              totals[rid] = (totals[rid] ?? 0) + (amt ?? 0);
            }
          }
        }
      }
      const pools = (snapshot.state.resourcesByPlayerId as Record<string, Record<string, number>>) ?? {};
      const current = { ...(pools[active.id] ?? {}) };
      for (const [rid, amt] of Object.entries(totals)) {
        current[rid] = (current[rid] ?? 0) + amt;
      }
      const resEntry = { id: action.actionId + ':res', at, kind: 'resourceResolution', message: `${active.name ?? active.id} resources resolved`, payload: { playerId: active.id, delta: totals, tileCount } };
      const passEntry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} ended their turn` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: { ...snapshot.state, resourcesByPlayerId: { ...pools, [active.id]: current }, activePlayerIndex: nextIndex, activePlayerId: players[nextIndex]?.id, phase: 'awaitingPlacement', round: 1, turnInRound: 1, roundStartPlayerIndex: 0, turn: (snapshot.state.turn as number) + 1 },
        log: [...snapshot.log, resEntry, passEntry],
      };
      // prune effects when new active player becomes active

      const pruned = pruneExpiredEffects(next.state as any, (next.state as any).activePlayerId);

      const next2 = { ...next, state: pruned } as GameSnapshot;

      GameSnapshotSchema.parse(next2);

      return { ok: true as const, next: next2, events: [resEntry, passEntry] };
    }

    if (action.type === 'core.drawTile') {
      if (phase !== 'awaitingAction') {
        return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Draw is only allowed after placement' } };
      }
      const supply = snapshot.state.supply as { tiles: Array<{ id: string; kind: string; production: Record<string, number> }>; drawIndex: number };
      if (supply.drawIndex >= supply.tiles.length) {
        return { ok: false as const, error: { code: 'SUPPLY_EMPTY' as EngineErrorCode, message: 'No tiles left to draw' } };
      }
      const hands = snapshot.state.hands as Record<string, Array<{ id: string; kind: string; production: Record<string, number> }>>;
      const hand: Array<{ id: string; kind: string; production: Record<string, number> }> = hands[active.id] ?? [];
      if (hand.length >= 5) {
        return { ok: false as const, error: { code: 'HAND_FULL' as EngineErrorCode, message: 'Hand limit reached' } };
      }
      const drawn = supply.tiles[supply.drawIndex]!;
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} drew a tile` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: {
          ...snapshot.state,
          supply: { tiles: supply.tiles, drawIndex: supply.drawIndex + 1 },
          hands: { ...hands, [active.id]: [...hand, drawn] },
          phase: 'awaitingPass',
        },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    if (action.type === 'core.placeTile') {
      if (phase !== 'awaitingPlacement') {
        return { ok: false as const, error: { code: 'PLACEMENT_ALREADY_DONE' as EngineErrorCode, message: 'Placement already performed this turn' } };
      }
      const payload = action.payload as { coord: { q: number; r: number }; tileId: string };
      // coord key stability is critical for determinism and replay.
      const key = `${payload.coord.q},${payload.coord.r}`;
      const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (board.cells.some((c) => c.key === key)) {
        return { ok: false as const, error: { code: 'CELL_OCCUPIED' as EngineErrorCode, message: 'Target cell is occupied' } };
      }
      if (board.cells.some((c) => c.tile.tile.id === payload.tileId)) {
        return { ok: false as const, error: { code: 'DUPLICATE_TILE_ID' as EngineErrorCode, message: 'Tile id already placed' } };
      }
      const hands = snapshot.state.hands as Record<string, Array<{ id: string; kind: string; production: Record<string, number> }>>;
      const hand = hands[active.id] ?? [];
      const tileIdx = hand.findIndex((t) => t.id === payload.tileId);
      if (tileIdx === -1) {
        return { ok: false as const, error: { code: 'TILE_NOT_IN_HAND' as EngineErrorCode, message: 'Tile not in active hand' } };
      }
      const tileObj = hand[tileIdx]!;
      const placed = { tile: tileObj, coord: payload.coord, placedBy: action.actorId, placedAtTurn: snapshot.state.turn as number };
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} placed tile ${tileObj.kind} at (${payload.coord.q},${payload.coord.r})` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: {
          ...snapshot.state,
          board: { cells: [...board.cells, { key, tile: placed }] },
          hands: { ...hands, [active.id]: hand.filter((_, i) => i !== tileIdx) },
          phase: 'awaitingAction',
        },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }
    if (action.type === 'core.placeInfluence') {
      if (phase !== 'awaitingAction') {
        return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence placement only allowed after placement' } };
      }
      const payload = action.payload as { coord: { q: number; r: number }; amount: 1 };
      const key = coordKey(payload.coord);
      const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (!board.cells.some((c) => c.key === key)) {
        return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'No tile at coord' } };
      }
      const infl = (snapshot.state as { influenceByCoord?: Record<string, Record<string, number>> }).influenceByCoord ?? {};
      const tileMap = { ...(infl[key] ?? {}) };
      const curr = tileMap[active.id] ?? 0;
      if (curr + 1 > 3) {
        return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached' } };
      }
      tileMap[active.id] = curr + 1;
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} placed influence at (${payload.coord.q},${payload.coord.r})` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: { ...snapshot.state, influenceByCoord: { ...infl, [key]: tileMap }, phase: 'awaitingPass' as const },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    if (action.type === 'core.moveInfluence') {
      if (phase !== 'awaitingAction') {
        return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Influence moving only allowed after placement' } };
      }
      const payload = action.payload as { from: { q: number; r: number }; to: { q: number; r: number }; amount: 1 };
      const fromKey = coordKey(payload.from); const toKey = coordKey(payload.to);
      const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };
      if (!board.cells.some((c) => c.key === fromKey) || !board.cells.some((c) => c.key === toKey)) {
        return { ok: false as const, error: { code: 'TILE_NOT_FOUND' as EngineErrorCode, message: 'From/To coord missing tile' } };
      }
      const infl = (snapshot.state as { influenceByCoord?: Record<string, Record<string, number>> }).influenceByCoord ?? {};
      const fromMap = { ...(infl[fromKey] ?? {}) };
      const toMap = { ...(infl[toKey] ?? {}) };
      const have = fromMap[active.id] ?? 0;
      if (have < 1) {
        return { ok: false as const, error: { code: 'INSUFFICIENT_INFLUENCE' as EngineErrorCode, message: 'Not enough influence to move' } };
      }
      const toCurr = toMap[active.id] ?? 0;
      if (toCurr + 1 > 3) {
        return { ok: false as const, error: { code: 'INFLUENCE_CAP_REACHED' as EngineErrorCode, message: 'Cap 3 per tile reached at destination' } };
      }
      fromMap[active.id] = have - 1;
      toMap[active.id] = toCurr + 1;
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} moved influence from (${payload.from.q},${payload.from.r}) to (${payload.to.q},${payload.to.r})` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: { ...snapshot.state, influenceByCoord: { ...infl, [fromKey]: fromMap, [toKey]: toMap }, phase: 'awaitingPass' as const },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }
    // Generic phase gate for unknown/expansion actions
    if (phase === 'awaitingPlacement') {
      return { ok: false as const, error: { code: 'ACTION_NOT_ALLOWED_IN_PHASE' as EngineErrorCode, message: 'Only placement allowed at turn start' } };
    }
    if (phase === 'awaitingPass' && action.type !== 'core.passTurn') {
      return { ok: false as const, error: { code: 'WRONG_TURN_PHASE' as EngineErrorCode, message: 'Only pass allowed now' } };
    }

    for (const reducer of registries.reducers) {
      const res = reducer(snapshot, action);
      if (res) {
        const at = Date.now();
        const entry = { id: action.actionId, at, kind: action.type, message: 'Action applied' };
        // If we were in awaitingAction and a non-pass action applied, move to awaitingPass.
        const nextState = (phase === 'awaitingAction' && action.type !== 'core.passTurn')
          ? { ...res.next.state, phase: 'awaitingPass' as const }
          : res.next.state;
        const next = { ...res.next, state: nextState, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };
        GameSnapshotSchema.parse(next);
        return { ok: true as const, next, events: [entry, ...(res.events ?? [])] };
      }
    }
    return { ok: false as const, error: { code: 'UNKNOWN_ACTION' as EngineErrorCode, message: `No reducer handled action: ${action.type}` } };
  }

  return { registries, createInitialSnapshot, applyAction };
}












