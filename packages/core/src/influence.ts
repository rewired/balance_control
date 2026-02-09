import type { GameState, HexCoord } from './protocol';
import { computeMajority } from './majority';

// Deprecated helper maintained for backward compatibility.
// Delegates to the centralized majority service (with lobbyist bonuses).
export function getTileMajority(state: GameState, coord: HexCoord): { leaderId: string | null; isTie: boolean; max: number } {
  const r = computeMajority(state, coord);
  return { leaderId: r.leaderId, isTie: r.isTie, max: r.max };
}
