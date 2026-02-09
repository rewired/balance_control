import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot, PlacedTile } from '../protocol';
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
  | 'TILE_NOT_IN_HAND';

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
    const snapshot: GameSnapshot = {
      sessionId: config.sessionId,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [], seed: config.seed ?? 'seed' },
      state: {
        players,
        activePlayerIndex: 0,
        turn: 1,
        board: { cells: [] },
        // Supply and hands start empty hands; no auto-draw in MVP.
        supply: { tiles: generateSupplyTiles({ seed: config.seed ?? 'seed' }), drawIndex: 0 },
        hands: Object.fromEntries(players.map((p) => [p.id, [] as Array<{ id: string; kind: string }>])),
        extensions: {},
      },
      log: [],
    };
    for (const id of snapshot.config.enabledExpansions) {
      const init = registries.stateInitializers.get(id);
      if (init) (snapshot.state.extensions as Record<string, unknown>)[id] = init();
    }
    return snapshot;
  }

  function applyAction(snapshot: GameSnapshot, action: ActionEnvelope) {
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

    if (action.type === 'core.noop') {
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };
      const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    // Turn logic is part of the core engine to keep a single authoritative ruleset.
    // The server orchestrates persistence and broadcasting but must not override core turn flow.
    if (action.type === 'core.passTurn') {
      // Validate actor authority: only the active player may pass the turn.
      const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;
      const activeIndex = snapshot.state.activePlayerIndex as number;
      const active = players[activeIndex];
      if (!active || players.length === 0) {
        return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };
      }
      if (action.actorId !== active.id) {
        return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Action actor is not the active player' } };
      }
      const nextIndex = (activeIndex + 1) % players.length;
      const at = Date.now();
      const entry = { id: action.actionId, at, kind: action.type, message: `${active.name ?? active.id} ended their turn` };
      const next: GameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        updatedAt: at,
        state: { ...snapshot.state, activePlayerIndex: nextIndex, turn: (snapshot.state.turn as number) + 1 },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    if (action.type === 'core.drawTile') {
      const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;
      const activeIndex = snapshot.state.activePlayerIndex as number;
      const active = players[activeIndex];
      if (!active) {
        return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };
      }
      const supply = snapshot.state.supply as { tiles: Array<{ id: string; kind: string }>; drawIndex: number };
      if (supply.drawIndex >= supply.tiles.length) {
        return { ok: false as const, error: { code: 'SUPPLY_EMPTY' as EngineErrorCode, message: 'No tiles left to draw' } };
      }
      const hands = snapshot.state.hands as Record<string, Array<{ id: string; kind: string }>>;
      const hand: Array<{ id: string; kind: string }> = hands[active.id] ?? [];
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
        },
        log: [...snapshot.log, entry],
      };
      GameSnapshotSchema.parse(next);
      return { ok: true as const, next, events: [entry] };
    }

    if (action.type === 'core.placeTile') {
  const payload = action.payload as { coord: { q: number; r: number }; tileId: string };
  const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;
  const activeIndex = snapshot.state.activePlayerIndex as number;
  const active = players[activeIndex];
  if (!active) {
    return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };
  }
  // Validate actor authority first
  if (action.actorId !== active.id) {
    return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Only active player may place' } };
  }
  // coord key stability is critical for determinism and replay.
  const key = `${payload.coord.q},${payload.coord.r}`;
  const board = snapshot.state.board as { cells: Array<{ key: string; tile: PlacedTile }> };
  if (board.cells.some((c) => c.key === key)) {
    return { ok: false as const, error: { code: 'CELL_OCCUPIED' as EngineErrorCode, message: 'Target cell is occupied' } };
  }
  if (board.cells.some((c) => c.tile.tile.id === payload.tileId)) {
    return { ok: false as const, error: { code: 'DUPLICATE_TILE_ID' as EngineErrorCode, message: 'Tile id already placed' } };
  }
  const hands = snapshot.state.hands as Record<string, Array<{ id: string; kind: string }>>;
      const hand: Array<{ id: string; kind: string }> = hands[active.id] ?? [];
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
    },
    log: [...snapshot.log, entry],
  };
  GameSnapshotSchema.parse(next);
  return { ok: true as const, next, events: [entry] };
}

    for (const reducer of registries.reducers) {
      const res = reducer(snapshot, action);
      if (res) {
        const at = Date.now();
        const entry = { id: action.actionId, at, kind: action.type, message: 'Action applied' };
        const next = { ...res.next, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };
        GameSnapshotSchema.parse(next);
        return { ok: true as const, next, events: [entry, ...(res.events ?? [])] };
      }
    }
    return { ok: false as const, error: { code: 'UNKNOWN_ACTION' as EngineErrorCode, message: `No reducer handled action: ${action.type}` } };
  }

  return { registries, createInitialSnapshot, applyAction };
}


