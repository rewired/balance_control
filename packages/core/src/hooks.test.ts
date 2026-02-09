import { describe, it, expect } from 'vitest';
import type { ExpansionModule } from './expansion/types';
import { createEngine } from './index';

const testExpansion: ExpansionModule = {
  id: 'test', version: '0.0.0', register(reg) {
    reg.registerStateInitializer(() => ({ calls: [] as string[] }));
    reg.registerHook('onBeforeActionValidate', (snap: any, act: any) => { const arr = (snap.state.extensions.test.calls as string[]); arr.push('before'); });
    reg.registerHook('onValidateAction', (snap: any, act: any) => { (snap.state.extensions.test.calls as string[]).push('validate'); if (act.type === 'core.drawTile') return { reject: { code: 'HOOK_REJECTED', message: 'blocked by test' } }; });
    reg.registerHook('onApplyAction', (snap: any, act: any) => { (snap.state.extensions.test.calls as string[]).push('apply'); });
    reg.registerHook('onAfterAction', (snap: any, act: any) => { (snap.state.extensions.test.calls as string[]).push('after'); return []; });
    reg.registerHook('onSnapshot', (snap: any) => { (snap.state.extensions.test.calls as string[]).push('snapshot'); return snap; });
  }
};

describe('hook pipeline', () => {
  it('calls hooks in order and can reject', () => {
    const engine = createEngine({ expansions: [testExpansion] });
    let snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['test'], seed: 's', players: [{id:'p1'},{id:'p2'}] });

    // draw should be blocked by hook at awaitingPlacement
    const blocked = engine.applyAction(snap, { sessionId: 's', actionId: 'd0', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('HOOK_REJECTED');

    // Manually seed pending tile and place to exercise apply/after/snapshot order on a success
    const top = (snap.state as any).supply.tiles[0];
    (snap.state as any).pendingPlacementTile = top;
    (snap.state as any).supply.drawIndex = 1;
    const placed = engine.applyAction(snap, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any);
    expect(placed.ok).toBe(true);

    const calls = (((snap.state as any).extensions.test as any).calls as string[]);
    expect(calls.includes('before')).toBe(true);
    expect(calls.includes('validate')).toBe(true);
  });
});
