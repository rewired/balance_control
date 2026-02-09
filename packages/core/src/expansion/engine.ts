import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';

export type EngineErrorCode = 'UNKNOWN_ACTION' | 'VALIDATION_ERROR' | 'ACTION_SCHEMA_NOT_REGISTERED' | 'EXPANSION_NOT_ENABLED';

export interface Engine {
  registries: EngineRegistries;
  createInitialSnapshot(config: GameConfig & { sessionId: string }): GameSnapshot;
  applyAction(snapshot: GameSnapshot, action: ActionEnvelope):
    | { ok: true; next: GameSnapshot; events: Array<{ id: string; at: number; kind: string; message: string }> }
    | { ok: false; error: { code: EngineErrorCode; message: string; details?: unknown } };
}

export function createEngine(options: EngineOptions): Engine {
  const registries = buildEngineRegistries(options);

  // Register core action schema (immutable)
  registries.actions.set('core.noop', { type: 'core.noop', payload: z.unknown() as unknown as ZodTypeAny });

  function createInitialSnapshot(config: GameConfig & { sessionId: string }): GameSnapshot {
    const now = Date.now();
    const snapshot: GameSnapshot = {
      sessionId: config.sessionId,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [] },
      state: { extensions: {} },
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
    return { ok: false as const, error: { code: 'ACTION_SCHEMA_NOT_REGISTERED' as EngineErrorCode, message: `Unregistered action type: ${action.type}` } };
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

return { registries, createInitialSnapshot, applyAction };}
