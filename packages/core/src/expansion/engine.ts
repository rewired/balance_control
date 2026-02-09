import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot, PlacedTile, ResourceDef } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';
import { generateSupplyTiles } from '../supply';

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
        phase: 'awaitingPlacement',
        turn: 1,
        board: { cells: [] },
        resources: { registry: resourcesRegistry },
        resourcesByPlayerId: pools,
        supply: { tiles, drawIndex },
        hands: handsInit,
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
    const parsed = (schema as { payload: ZodTypeAny }).payload.safeParse(action.payload);
    if (!parsed.success) {
      return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'Invalid payload', details: parsed.error.flatten() } };
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
        state: { ...snapshot.state, resourcesByPlayerId: { ...pools, [active.id]: current }, activePlayerIndex: nextIndex, activePlayerId: players[nextIndex]?.id, phase: 'awaitingPlacement', turn: (snapshot.state.turn as number) + 1 },
        log: [...snapshot.log, resEntry, passEntry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [resEntry, passEntry] };
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











