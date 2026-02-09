import { describe, it, expect } from 'vitest';
import { createEngine } from './index';

const players = [ { id: 'p1' }, { id: 'p2' }, { id: 'p3' } ];

describe('round tracking', () => {
  it('increments round after full table loop', () => {
    const engine = createEngine({ expansions: [] });
    let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 'seed', players });
    // p1 place/draw/pass
    const t1 = (s.state.hands as any)['p1'][0].id as string;
    let r = engine.applyAction(s, { sessionId: 's', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: t1 }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x1', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 pass');
    s = r.next;
    expect((s.state as any).round).toBe(1);
    expect((s.state as any).turnInRound).toBe(2);
    // p2
    const t2 = (s.state.hands as any)['p2'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 }, tileId: t2 }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x2', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 pass');
    s = r.next;
    expect((s.state as any).round).toBe(1);
    expect((s.state as any).turnInRound).toBe(3);
    // p3 -> after pass wraps to start, round increments
    const t3 = (s.state.hands as any)['p3'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p3', type: 'core.placeTile', payload: { coord: { q: 2, r: 0 }, tileId: t3 }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'd3', type: 'core.drawTile', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x3', type: 'core.passTurn', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 pass');
    s = r.next;
    expect((s.state as any).round).toBe(2);
    expect((s.state as any).turnInRound).toBe(1);
  });
});