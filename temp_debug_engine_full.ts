import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';

export type EngineErrorCode =
  | 'UNKNOWN_ACTION'
  | 'VALIDATION_ERROR'
  | 'ACTION_SCHEMA_NOT_REGISTERED'
  | 'EXPANSION_NOT_ENABLED'
  | 'NOT_ACTIVE_PLAYER' | 'CELL_OCCUPIED' | 'DUPLICATE_TILE_ID';

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
  registries.actions.set('core.passTurn', { type: 'core.passTurn', payload: z.object({}).strict() as ZodTypeAny });\n  registries.actions.set('core.placeTile', {\n    type: 'core.placeTile',\n    payload: z.object({\n      coord: z.object({ q: z.number().int(), r: z.number().int() }),\n      tile: z.object({ id: z.string(), kind: z.string().min(1) }),\n    }) as ZodTypeAny,\n  });

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
      config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [] },
      state: {\n        players,\n        activePlayerIndex: 0,\n        turn: 1,\n        board: { cells: {} },\n        extensions: {},\n      },
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
      return { ok: true as const, next, events: [entry] };\n    }\n\n    if (action.type === 'core.placeTile') {\n      const payload = action.payload as { coord: { q: number; r: number }; tile: { id: string; kind: string } };\n      const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;
      const activeIndex = snapshot.state.activePlayerIndex as number;\n      const active = players[activeIndex];\n      if (!active) {\n        return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };\n      }\n      if (action.actorId !== active.id) {\n        return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Only active player may place' } };\n      }\n      // coord key stability is critical for determinism and replay.\n      const key = ${payload.coord.q},;\n      const board = (snapshot.state.board as { cells: Record<string, any> });\n      if (board.cells[key]) {\n        return { ok: false as const, error: { code: 'CELL_OCCUPIED' as EngineErrorCode, message: 'Target cell is occupied' } };\n      }\n      // reject duplicate tile id anywhere on board\n      const exists = Object.values(board.cells).some((pt: any) => pt.tile.id === payload.tile.id);\n      if (exists) {\n        return { ok: false as const, error: { code: 'DUPLICATE_TILE_ID' as EngineErrorCode, message: 'Tile id already placed' } };\n      }\n      const placed = { tile: payload.tile, coord: payload.coord, placedBy: action.actorId, placedAtTurn: snapshot.state.turn as number };\n      const at = Date.now();\n      const entry = { id: action.actionId, at, kind: action.type, message: ${active.name ?? active.id} placed tile  at (,) };\n      const next: GameSnapshot = {\n        ...snapshot,\n        revision: snapshot.revision + 1,\n        updatedAt: at,\n        state: {\n          ...snapshot.state,\n          board: { cells: { ...board.cells, [key]: placed } },\n        },\n        log: [...snapshot.log, entry],\n      };\n      GameSnapshotSchema.parse(next);\n      return { ok: true as const, next, events: [entry] };\n    }\n\n    for (const reducer of registries.reducers) {
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
