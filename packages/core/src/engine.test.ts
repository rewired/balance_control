import { describe, it, expect } from 'vitest';
import type { ActionEnvelope } from './index';
import { createInitialState, applyAction } from './index';

describe('engine applyAction', () => {
  const base = createInitialState({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [] });

  it('accepts core.noop and increments revision', () => {
    const action: ActionEnvelope = {
      sessionId: 's1',
      actionId: 'a1',
      type: 'core.noop',
      payload: null,
      actorId: 'hotseat',
    };
    const res = applyAction(base, action);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.next.revision).toBe(base.revision + 1);
      expect(res.next.log.at(-1)?.id).toBe('a1');
    }
  });

  it('rejects unknown action', () => {
    const action: ActionEnvelope = {
      sessionId: 's1',
      actionId: 'a2',
      type: 'core.unknown',
      payload: null,
      actorId: 'hotseat',
    };
    const res = applyAction(base, action);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN_ACTION');
  });
});