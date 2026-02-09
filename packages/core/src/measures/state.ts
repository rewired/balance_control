import type { MeasureState } from './types';

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h >>> 0;
}
function lcg(seed: number) { let x = seed >>> 0; const a = 1664525; const c = 1013904223; return () => (x = (a * x + c) >>> 0); }

export function initMeasureState(opts: { playerIds: string[]; deckIds: string[]; seed: string }): MeasureState {
  const rnd = lcg(hashSeed(opts.seed + '|measures'));
  const deck = [...opts.deckIds];
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = deck[i]; deck[i] = deck[j]!; deck[j] = t!; }
  const drawPile = deck;
  const state: MeasureState = { drawPile, discardPile: [], faceUp: [], recycled: false, playsByMeasureId: {}, playedThisRoundByPlayerId: Object.fromEntries(opts.playerIds.map(id => [id, false])), handByPlayerId: Object.fromEntries(opts.playerIds.map(id => [id, []])), seed: opts.seed };
  return refillFaceUp(state);
}

export function refillFaceUp(state: MeasureState): MeasureState {
  const next: MeasureState = { ...state, drawPile: [...state.drawPile], discardPile: [...state.discardPile], faceUp: [...state.faceUp], handByPlayerId: { ...state.handByPlayerId }, playsByMeasureId: { ...state.playsByMeasureId }, playedThisRoundByPlayerId: { ...state.playedThisRoundByPlayerId } };
  while (next.faceUp.length < 3) {
    if (next.drawPile.length === 0) {
      if (!next.recycled && next.discardPile.length > 0) {
        // one-time recycle: shuffle discard into draw
        const rnd = lcg(hashSeed(`${next.seed}|measures|recycle`));
        const d = [...next.discardPile]; next.discardPile = []; next.recycled = true;
        for (let i = d.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = d[i]; d[i] = d[j]!; d[j] = t!; }
        next.drawPile = d;
      } else break;
    }
    if (next.drawPile.length === 0) break;
    next.faceUp.push(next.drawPile.shift()!);
  }
  return next;
}

export function takeFaceUpMeasure(state: MeasureState, playerId: string, index: 0 | 1 | 2): MeasureState {
  const next = { ...state, drawPile: [...state.drawPile], discardPile: [...state.discardPile], faceUp: [...state.faceUp], handByPlayerId: { ...state.handByPlayerId }, playsByMeasureId: { ...state.playsByMeasureId }, playedThisRoundByPlayerId: { ...state.playedThisRoundByPlayerId } } as MeasureState;
  const face = next.faceUp[index];
  if (face === undefined) throw new Error('INVALID_FACE_INDEX');
  const hand = next.handByPlayerId[playerId] ?? [];
  if (hand.length >= 2) throw new Error('HAND_LIMIT');
  hand.push(face);
  next.handByPlayerId[playerId] = hand;
  next.faceUp.splice(index, 1);
  return refillFaceUp(next);
}

export function playMeasure(state: MeasureState, playerId: string, measureId: string): MeasureState {
  const next = { ...state, drawPile: [...state.drawPile], discardPile: [...state.discardPile], faceUp: [...state.faceUp], handByPlayerId: { ...state.handByPlayerId }, playsByMeasureId: { ...state.playsByMeasureId }, playedThisRoundByPlayerId: { ...state.playedThisRoundByPlayerId } } as MeasureState;
  const hand = next.handByPlayerId[playerId] ?? [];
  const idx = hand.indexOf(measureId);
  if (idx === -1) throw new Error('MEASURE_NOT_IN_HAND');
  if (next.playedThisRoundByPlayerId[playerId]) throw new Error('ROUND_PLAY_LIMIT');
  const plays = next.playsByMeasureId[measureId] ?? 0;
  if (plays >= 2) throw new Error('MEASURE_PLAYED_MAX');
  hand.splice(idx, 1);
  next.discardPile.push(measureId);
  next.playsByMeasureId[measureId] = plays + 1;
  next.playedThisRoundByPlayerId[playerId] = true;
  return next;
}

export function clearPlayedThisRoundFlags(state: MeasureState): MeasureState {
  const next = { ...state, playedThisRoundByPlayerId: { ...state.playedThisRoundByPlayerId } };
  for (const k of Object.keys(next.playedThisRoundByPlayerId).sort()) next.playedThisRoundByPlayerId[k] = false;
  return next;
}



