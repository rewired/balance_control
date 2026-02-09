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
  | 'NOT_ACTIVE_PLAYER';

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
      state: {
        players,
        activePlayerIndex: 0,
        turn: 1,
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