import type { GameState, HexCoord } from './protocol';

// Compute majority for a tile at coord based on influenceByCoord.
// Determinism: iterate players in state.players order so ties are reproducible.
export function getTileMajority(state: GameState, coord: HexCoord): { leaderId: string | null; isTie: boolean; max: number } {
  const key = `${coord.q},${coord.r}`;
  const perPlayer: Record<string, number> = (state.influenceByCoord?.[key]) ?? {};
  let leaderId: string | null = null;
  let max = 0;
  let tie = false;
  for (const p of state.players) {
    const v = perPlayer[p.id] ?? 0;
    if (v > max) { leaderId = p.id; max = v; tie = false; }
    else if (v === max && v !== 0) { tie = true; leaderId = null; }
  }
  if (max === 0) return { leaderId: null, isTie: false, max: 0 };
  return { leaderId, isTie: tie, max };
}