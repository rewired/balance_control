import type { GameState } from './protocol';

// Expire effects based on turn/round/next-turn-of-player invariants.
export function pruneExpiredEffects(state: GameState, aboutToBeActivePlayerId?: string): GameState {
  const nowTurn = state.turn as number;
  const nowRound = state.round as number | undefined;
  const nextActiveId = aboutToBeActivePlayerId;
  const next: GameState = { ...state } as GameState;
  const keep = (state.effects ?? []).filter((e) => {
    if (e.expires?.atTurn !== undefined && e.expires.atTurn <= nowTurn) return false;
    if (e.expires?.atRound !== undefined && nowRound !== undefined && e.expires.atRound <= nowRound) return false;
    if (e.expires?.atNextTurnOfPlayerId && nextActiveId && e.expires.atNextTurnOfPlayerId === nextActiveId) return false;
    return true;
  });
  next.effects = keep;
  return next;
}
