import { describe, it, expect } from 'vitest';
import { initMeasureState, takeFaceUpMeasure, playMeasure, refillFaceUp, clearPlayedThisRoundFlags } from './measures/state';

describe('measures scaffold', () => {
  it('take refills and enforces hand limit', () => {
    const st0 = initMeasureState({ playerIds: ['p1','p2'], deckIds: ['m1','m2','m3','m4','m5'], seed: 's' });
    const st1 = takeFaceUpMeasure(st0, 'p1', 0);
    expect(st1.faceUp.length).toBe(3);
    const st2 = takeFaceUpMeasure(st1, 'p1', 0);
    expect(st2.handByPlayerId['p1'].length).toBe(2);
    expect(() => takeFaceUpMeasure(st2, 'p1', 0)).toThrowError('HAND_LIMIT');
  });
  it('play enforces per-round and per-card caps; recycle once', () => {
    let st = initMeasureState({ playerIds: ['p1'], deckIds: ['a','b','c'], seed: 'x' });
    // Fill hand with two cards
    st = takeFaceUpMeasure(st, 'p1', 0);
    st = takeFaceUpMeasure(st, 'p1', 0);
    const first = st.handByPlayerId['p1'][0];
    st = playMeasure(st, 'p1', first);
    expect(st.discardPile.includes(first)).toBe(true);
    expect(() => playMeasure(st, 'p1', st.handByPlayerId['p1'][0])).toThrowError('ROUND_PLAY_LIMIT');
    st = clearPlayedThisRoundFlags(st);
    const second = st.handByPlayerId['p1'][0];
    st = playMeasure(st, 'p1', second);
    // Drain draw pile; attempt to refill beyond -> triggers (single) recycle when discard present
    st = refillFaceUp({ ...st, drawPile: [], recycled: false });
    expect(st.recycled).toBe(true);
  });
});