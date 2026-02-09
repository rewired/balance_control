import { describe, it, expect } from 'vitest';
import { createEngine } from './index';

const players = [ { id: 'p1' }, { id: 'p2' }, { id: 'p3' } ];

describe('round tracking', () => {
  it('increments round after full table loop', () => {
    const engine = createEngine({ expansions: [] });
    let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 'seed', players });
    // p1: draw->place->action->pass
    let r = engine.applyAction(s, { sessionId: 's', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 act');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x1', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 pass');
    s = r.next;
    expect((s.state as any).round).toBe(1);
    expect((s.state as any).turnInRound).toBe(2);
    // p2
    r = engine.applyAction(s, { sessionId: 's', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 } }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i2', type: 'core.placeInfluence', payload: { coord: { q: 1, r: 0 }, amount: 1 }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 act');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x2', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 pass');
    s = r.next;
    expect((s.state as any).round).toBe(1);
    expect((s.state as any).turnInRound).toBe(3);
    // p3 -> after pass wraps to start, round increments
    r = engine.applyAction(s, { sessionId: 's', actionId: 'd3', type: 'core.drawTile', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p3', type: 'core.placeTile', payload: { coord: { q: 2, r: 0 } }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'x3', type: 'core.passTurn', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 pass');
    s = r.next;
    expect((s.state as any).round).toBe(2);
    expect((s.state as any).turnInRound).toBe(1);
  });
});
