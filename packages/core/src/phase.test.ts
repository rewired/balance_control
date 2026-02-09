import { describe, it, expect } from 'vitest';
import { createEngine } from './index';

const players = [ { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' } ];

describe('turn phase enforcement', () => {
  const engine = createEngine({ expansions: [] });

  it('flow: place -> draw -> pass; rejects wrong phases', () => {
    let snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 'seed', players });
    // Initially awaitingPlacement: draw is rejected
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'd0', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ACTION_NOT_ALLOWED_IN_PHASE');

    // Draw one tile into hand first by moving via place flow
    // First draw is not allowed; draw from supply should happen only after placement per rules
    // So draw nothing yet; instead simulate tile from supply
    const d = engine.applyAction(snap, { sessionId: 's', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(d.ok).toBe(false);

    // Give p1 a tile by drawing after place
    // Make sure p1 has at least one tile: do a minimal workaround
    // We'll allow using supply directly by doing one draw after place.

    // First, draw is still disallowed; so place requires a tile in hand.
    // Draw a tile into hand by temporarily allowing one draw through direct engine rule:
    // Instead, we use the actual flow: supply tiles exist; but place requires tile in hand.
    // So we draw a tile by switching to awaitingAction after a fake placement is not possible.
    // Better: manually take a tile id from supply and push into hand (test setup only).
    const tileId = snap.state.supply.tiles[0].id;
    (snap.state.hands as any)['p1'] = [{ id: tileId, kind: snap.state.supply.tiles[0].kind }];

    // Place in awaitingPlacement
    r = engine.applyAction(snap, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId }, actorId: 'p1' } as any);
    expect(r.ok).toBe(true);
    snap = (r as any).next;
    expect((snap.state as any).phase).toBe('awaitingAction');

    // Second placement this turn rejected
    const r2 = engine.applyAction(snap, { sessionId: 's', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 }, tileId: 't9999' }, actorId: 'p1' } as any);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('PLACEMENT_ALREADY_DONE');

    // Draw allowed now and moves to awaitingPass
    const r3 = engine.applyAction(snap, { sessionId: 's', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r3.ok).toBe(true);
    snap = (r3 as any).next;
    expect((snap.state as any).phase).toBe('awaitingPass');

    // Another draw now rejected
    const r4 = engine.applyAction(snap, { sessionId: 's', actionId: 'd3', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r4.ok).toBe(false); if (!r4.ok) expect(['WRONG_TURN_PHASE','ACTION_NOT_ALLOWED_IN_PHASE']).toContain(r4.error.code);

    // Pass allowed and moves to next player & awaitingPlacement
    const r5 = engine.applyAction(snap, { sessionId: 's', actionId: 'pass', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    expect(r5.ok).toBe(true);
    snap = (r5 as any).next;
    expect((snap.state as any).phase).toBe('awaitingPlacement');
    expect(snap.state.activePlayerIndex).toBe(1);
  });
});


