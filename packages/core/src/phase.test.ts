import { describe, it, expect } from 'vitest';
import { createEngine } from './index';

const players = [ { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' } ];

describe('turn phase enforcement (7.1 -> 7.2 -> pass)', () => {
  const engine = createEngine({ expansions: [] });

  it('flow: draw -> place -> action -> pass; rejects wrong phases', () => {
    let snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 'seed', players });

    // Place before draw -> error
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'p0', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ACTION_NOT_ALLOWED_IN_PHASE');

    // Draw allowed at awaitingPlacement; becomes pending tile
    r = engine.applyAction(snap, { sessionId: 's', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r.ok).toBe(true);
    snap = (r as any).next;

    // Pass before action -> error (must place first)
    let rPass = engine.applyAction(snap, { sessionId: 's', actionId: 'pass0', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    expect(rPass.ok).toBe(false); if (!rPass.ok) expect(rPass.error.code).toBe('WRONG_TURN_PHASE');

    // Place -> moves to awaitingAction
    let rPlace = engine.applyAction(snap, { sessionId: 's', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any);
    expect(rPlace.ok).toBe(true);
    snap = (rPlace as any).next;
    expect((snap.state as any).phase).toBe('awaitingAction');

    // One action -> awaitingPass
    const rAct = engine.applyAction(snap, { sessionId: 's', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any);
    expect(rAct.ok).toBe(true);
    const afterAct = (rAct as any).next;
    expect((afterAct.state as any).phase).toBe('awaitingPass');

    // Pass allowed -> next player
    const r2 = engine.applyAction(afterAct, { sessionId: 's', actionId: 'pass', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const s2 = r2.next;
      expect(s2.state.activePlayerIndex).toBe(1);
      expect((s2.state as any).phase).toBe('awaitingPlacement');
    }
  });
});