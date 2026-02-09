// Minimal engine scaffolding; rules intentionally not implemented.
// Deterministic and side-effect free helpers.
import type { ActionEnvelope, GameConfig, GameSnapshot } from './protocol';

export function createInitialState(config: GameConfig & { sessionId: string }): GameSnapshot {
  const now = Date.now();
  return {
    sessionId: config.sessionId,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [] },
    state: { players: [], activePlayerIndex: 0, turn: 1, extensions: {} },
    log: [],
  };
}

export type ApplyResult =
  | { ok: true; next: GameSnapshot; events: Array<{ id: string; at: number; kind: string; message: string }> }
  | { ok: false; error: { code: 'UNKNOWN_ACTION' | 'VALIDATION_ERROR'; message: string } };

export function applyAction(current: GameSnapshot, action: ActionEnvelope): ApplyResult {
  // Only accept a trivial action at this stage; unknown actions are rejected.
  if (action.type !== 'core.noop' && action.type !== 'core.ping') {
    return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action type: ${action.type}` } };
  }
  const at = Date.now();
  const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };
  const next: GameSnapshot = {
    ...current,
    revision: current.revision + 1,
    updatedAt: at,
    log: [...current.log, entry],
  };
  return { ok: true, next, events: [entry] };
}