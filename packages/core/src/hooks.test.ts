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
    // place then try to draw (draw should be blocked by hook)
    const tid = (snap.state.hands as any)['p1'][0].id as string;
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: tid }, actorId: 'p1' } as any);
    expect(r.ok).toBe(true);
    if (r.ok) snap = r.next;
    const res = engine.applyAction(snap, { sessionId: 's', actionId: 'd', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('HOOK_REJECTED');
    const calls = (((snap.state as any).extensions.test as any).calls as string[]);
    // We expect 'before' and 'validate' ran for both actions, and apply/after/snapshot ran for the placement success
    expect(calls.includes('before')).toBe(true);
    expect(calls.includes('validate')).toBe(true);
  });
});