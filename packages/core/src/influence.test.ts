import { describe, it, expect } from 'vitest';
import { createEngine, getTileMajority } from './index';

const players = [ { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' } ];

describe('influence + majority', () => {
  it('place influence increases count and second optional action in same turn is rejected', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 's', players });
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'd', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('draw failed');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('place failed');
    // place influence -> awaitingPass
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any);
    expect(r.ok).toBe(true);
    const key = '0,0';
    if (!r.ok) throw new Error('infl failed');
    expect(((r.next.state as any).influenceByCoord[key]['p1'])).toBe(1);
    // second influence in same turn should be blocked by phase
    const again = engine.applyAction(r.next, { sessionId: 's', actionId: 'i2', type: 'core.placeInfluence', payload: { coord: { q: 0, r: 0 }, amount: 1 }, actorId: 'p1' } as any);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(['WRONG_TURN_PHASE','ACTION_NOT_ALLOWED_IN_PHASE']).toContain(again.error.code);
  });

  it('cap=3: fourth placement is rejected with INFLUENCE_CAP_REACHED', () => {
    const engine = createEngine({ expansions: [] });
    // Seed snapshot with 3 influence for p1 on existing tile and be at awaitingAction
    const snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 's', players });
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'd', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 5, r: 5 } }, actorId: 'p1' } as any); if (!r.ok) throw new Error('place');
    // Manually seed influence to cap (tests may directly prepare state for edge checks)
    const st: any = r.next.state;
    st.influenceByCoord['5,5'] = { ...(st.influenceByCoord['5,5'] ?? {}), p1: 3 };
    // Now attempt to place one more (still same turn and in awaitingAction? we need awaitingPass after placeInfluence; but we didn't place influence this turn; we are in awaitingAction)
    const over = engine.applyAction({ ...r.next, state: st }, { sessionId: 's', actionId: 'iX', type: 'core.placeInfluence', payload: { coord: { q: 5, r: 5 }, amount: 1 }, actorId: 'p1' } as any);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('INFLUENCE_CAP_REACHED');
  });

  it('majority helper: none / leader', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 's', players });
    let r = engine.applyAction(snap, { sessionId: 's', actionId: 'd', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p', type: 'core.placeTile', payload: { coord: { q: 7, r: 7 } }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('place failed');
    let maj = getTileMajority(r.next.state, { q: 7, r: 7 });
    expect(maj).toEqual({ leaderId: null, isTie: false, max: 0 });
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'i1', type: 'core.placeInfluence', payload: { coord: { q: 7, r: 7 }, amount: 1 }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('infl failed');
    maj = getTileMajority(r.next.state, { q: 7, r: 7 });
    expect(maj.leaderId).toBe('p1');
    expect(maj.isTie).toBe(false);
    expect(maj.max).toBe(1);
  });
});