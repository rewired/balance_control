import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';

const players = [
  { id: 'p1', name: 'Player 1' },
  { id: 'p2', name: 'Player 2' },
  { id: 'p3', name: 'Player 3' },
];

describe('core turns and passTurn', () => {
  const engine = createEngine({ expansions: [] });

  it('initial state: turn=1 and active players[0]', () => {
    const snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    expect(snap.state.turn).toBe(1);
    expect(snap.state.activePlayerIndex).toBe(0);
    expect(snap.state.players[0].id).toBe('p1');
  });

  it('core.passTurn advances active player and increments turn; wraps around', () => {
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players: players.slice(0, 2) });
    // p1: draw -> place -> one action -> pass
    let res = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any);
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any);
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'a1', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      snap = res.next;
      expect(snap.state.activePlayerIndex).toBe(1);
      expect(snap.state.turn).toBe(2);
    }
    // p2: draw -> place -> action -> pass; wrap to p1
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' });
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 } }, actorId: 'p2' } as any);
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'i2', type: 'core.placeInfluence', payload: { coord: { q: 1, r: 0 }, amount: 1 }, actorId: 'p2' } as any);
    expect(res.ok).toBe(true); if (res.ok) snap = res.next;
    res = engine.applyAction(snap, { sessionId: 's1', actionId: 'a2', type: 'core.passTurn', payload: {}, actorId: 'p2' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      snap = res.next;
      expect(snap.state.activePlayerIndex).toBe(0); // wrap
      expect(snap.state.turn).toBe(3);
    }
  });

  it('rejects passTurn from non-active player', () => {
    const snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const bad: ActionEnvelope = { sessionId: 's1', actionId: 'x', type: 'core.passTurn', payload: {}, actorId: 'p2' }; // p1 is active
    const res = engine.applyAction(snap, bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_ACTIVE_PLAYER');
  });
});
