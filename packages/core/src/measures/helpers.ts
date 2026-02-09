import type { MeasureState } from './types';
import { initMeasureState, takeFaceUpMeasure, playMeasure as corePlay, clearPlayedThisRoundFlags } from './state';

export function createMeasureState(params: { playerIds: string[]; deckIds: string[]; seed: string }): MeasureState {
  return initMeasureState(params);
}

export function takeMeasure(state: MeasureState, playerId: string, faceUpIndex: 0 | 1 | 2): MeasureState {
  return takeFaceUpMeasure(state, playerId, faceUpIndex);
}

export function playMeasure(state: MeasureState, playerId: string, measureId: string): MeasureState {
  return corePlay(state, playerId, measureId);
}

export function resetMeasureRoundFlags(state: MeasureState): MeasureState {
  return clearPlayedThisRoundFlags(state);
}

