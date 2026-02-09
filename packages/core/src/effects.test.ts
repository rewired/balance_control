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
  it('draw becomes allowed again at next turn of p1 (effect expires)', () => {
    const engine = createEngine({ expansions: [blocker] });
    let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['block'], seed: 'seed', players });

    // p1: draw and place
    let r = engine.applyAction(s, { sessionId: 's', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 place');
    s = r.next;

    // Insert effect now that blocks draw until next turn of p1
    (s.state as any).effects = [{ id: 'e1', source: { kind: 'system' }, ownerPlayerId: 'p1', createdAtTurn: s.state.turn, expires: { atNextTurnOfPlayerId: 'p1' }, modifiers: { blockActionTypes: ['core.drawTile'] } }];

    // p1: perform one action and pass
    r = engine.applyAction(s, { sessionId: 's', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 act');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 pass');
    s = r.next;

    // p2 quick turn
    r = engine.applyAction(s, { sessionId: 's', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 } }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i2', type: 'core.placeInfluence', payload: { coord: { q: 1, r: 0 }, amount: 1 }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 act');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x2', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 pass');
    s = r.next;

    // p3 quick turn
    r = engine.applyAction(s, { sessionId: 's', actionId: 'd3', type: 'core.drawTile', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p3', type: 'core.placeTile', payload: { coord: { q: 2, r: 0 } }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i3', type: 'core.placeInfluence', payload: { coord: { q: 2, r: 0 }, amount: 1 }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 act');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x3', type: 'core.passTurn', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 pass');
    s = r.next; // p1 active again; effect should expire at this turn boundary

    // Now p1 draw should be allowed (effect expired)
    const ok = engine.applyAction(s, { sessionId: 's', actionId: 'd4', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    expect(ok.ok).toBe(true);
  });
});

