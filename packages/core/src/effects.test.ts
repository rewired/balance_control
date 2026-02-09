import { describe, it, expect } from 'vitest';
import type { ExpansionModule } from './expansion/types';
import { createEngine } from './index';

// Hook that blocks actions listed in effects.modifiers.blockActionTypes
const blocker: ExpansionModule = { id: 'block', version: '0.0.0', register(reg) {
  reg.registerHook('onValidateAction', (snap: any, action: any) => {
    const effs = (snap.state.effects ?? []) as Array<any>;
    for (const e of effs) {
      const blocks = e?.modifiers?.blockActionTypes as string[] | undefined;
      if (blocks && blocks.includes(action.type)) return { reject: { code: 'HOOK_REJECTED', message: 'blocked by effect' } };
    }
  });
} };

const players = [ { id: 'p1' }, { id: 'p2' }, { id: 'p3' } ];

describe('effects expiry and blocking', () => {
  it('blocks draw until next turn of p1, then expires', () => {
    const engine = createEngine({ expansions: [blocker] });
    let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['block'], seed: 'seed', players });
    // place for p1 to enter awaitingAction
    const t1 = (s.state.hands as any)['p1'][0].id as string;
    let r = engine.applyAction(s, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: t1 }, actorId: 'p1' } as any); if (!r.ok) throw new Error('place');
    s = r.next;
    // insert effect: block draw until next turn of p1
    (s.state as any).effects = [{ id: 'e1', source: { kind: 'system' }, ownerPlayerId: 'p1', createdAtTurn: s.state.turn, expires: { atNextTurnOfPlayerId: 'p1' }, modifiers: { blockActionTypes: ['core.drawTile'] } }];
    // attempt draw now (blocked)
    const blocked = engine.applyAction(s, { sessionId: 's', actionId: 'd', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    expect(blocked.ok).toBe(false);
    // finish p1 by passing (need optional action, so directly pass is allowed?) currently waitingPass required after draw or influence; after placement we are awaitingAction, so pass is not allowed; do a draw? but blocked.
    // Instead, pass path: we allow only pass in awaitingPass; so we need any optional action to move to awaitingPass. Since draw is blocked, emulate by placing influence is unavailable; simplest: set phase manually in test, then pass to rotate.
    (s.state as any).phase = 'awaitingPass';
    r = engine.applyAction(s, { sessionId: 's', actionId: 'x', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('pass');
    s = r.next;
    // Rotate p2: place/draw/pass fast
    const t2 = (s.state.hands as any)['p2'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 }, tileId: t2 }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x2', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 pass');
    s = r.next;
    // Rotate p3 similarly
    const t3 = (s.state.hands as any)['p3'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p3', type: 'core.placeTile', payload: { coord: { q: 2, r: 0 }, tileId: t3 }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'd3', type: 'core.drawTile', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x3', type: 'core.passTurn', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 pass');
    s = r.next; // p1 active again; effect should expire in passTurn tick
    // Phase model requires placement before draw; set awaitingAction for this targeted expiry test
    (s.state as any).phase = 'awaitingAction';
    // Now p1 can draw again
    const ok = engine.applyAction(s, { sessionId: 's', actionId: 'd4', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    expect(ok.ok).toBe(true);
  });
});
