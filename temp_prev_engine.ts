import { z, type ZodTypeAny } from 'zod';
import type { ActionEnvelope, GameConfig, GameSnapshot } from '../protocol';
import { GameSnapshotSchema } from '../protocol';
import type { EngineRegistries, EngineOptions } from './types';
import { buildEngineRegistries } from './registry';

export type EngineErrorCode = 'UNKNOWN_ACTION' | 'VALIDATION_ERROR' | 'ACTION_SCHEMA_NOT_REGISTERED' | 'EXPANSION_NOT_ENABLED' | 'NOT_ACTIVE_PLAYER';

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
  registries.actions.set('core.noop', { type: 'core.noop', payload: z.unknown() as unknown as ZodTypeAny });\n  registries.actions.set('core.passTurn', { type: 'core.passTurn', payload: z.object({}).strict() as unknown as ZodTypeAny });

  function createInitialSnapshot(config: (GameConfig & { sessionId: string }) & { players?: Array<{ id: string; name?: string }> }): GameSnapshot {\n    const now = Date.now();\n    const players = (config.players ?? []).map((p, i) => ({ id: p.id, name: p.name, index: i }));\n    const snapshot: GameSnapshot = {\n      sessionId: config.sessionId,\n      revision: 0,\n      createdAt: now,\n      updatedAt: now,\n      config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [] },\n      state: {\n        players,\n        activePlayerIndex: 0,\n        turn: 1,\n        extensions: {}\n      },\n      log: [],\n    };\n    for (const id of snapshot.config.enabledExpansions) {\n      const init = registries.stateInitializers.get(id);\n      if (init) (snapshot.state.extensions as Record<string, unknown>)[id] = init();\n    }\n    return snapshot;\n  }

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

  if (action.type === 'core.noop') {\n    const at = Date.now();\n    const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };\n    const next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, log: [...snapshot.log, entry] };\n    GameSnapshotSchema.parse(next);\n    return { ok: true as const, next, events: [entry] };\n  }\n\n  if (action.type === 'core.passTurn') {\n    // Validate actor authority: only the active player may pass the turn.\n    const players = snapshot.state.players as Array<{ id: string; index: number; name?: string }>;\n    const activeIndex = snapshot.state.activePlayerIndex as number;\n    const active = players[activeIndex];\n    if (!active || players.length === 0) {\n      return { ok: false as const, error: { code: 'VALIDATION_ERROR' as EngineErrorCode, message: 'No players initialized' } };\n    }\n    if (action.actorId !== active.id) {\n      return { ok: false as const, error: { code: 'NOT_ACTIVE_PLAYER' as EngineErrorCode, message: 'Action actor is not the active player' } };\n    }\n    const nextIndex = (activeIndex + 1) % players.length;\n    const at = Date.now();\n    const entry = { id: action.actionId, at, kind: action.type, message: ${active.name ?? active.id} ended their turn };\n    const next: GameSnapshot = {\n      ...snapshot,\n      revision: snapshot.revision + 1,\n      updatedAt: at,\n      state: {\n        ...snapshot.state,\n        activePlayerIndex: nextIndex,\n        turn: (snapshot.state.turn as number) + 1,\n      },\n      log: [...snapshot.log, entry],\n    };\n    GameSnapshotSchema.parse(next);\n    return { ok: true as const, next, events: [entry] };\n  }\n\n  for (const reducer of registries.reducers) {
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




