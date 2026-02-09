import type { GameState, HexCoord } from './protocol';
import { coordKey, neighbors } from './coord';

export type MajorityResult = {
  coordKey: string;
  baseByPlayerId: Record<string, number>;
  lobbyBonusByPlayerId: Record<string, number>;
  totalByPlayerId: Record<string, number>;
  max: number;
  leaderId: string | null;
  isTie: boolean;
};

// Recognize lobbyist-like kinds by tolerant string matching.
const LOBBYIST_KINDS = new Set<string>([
  'lobbyist',
  'lobbyisten',
  'campaign',
]);

export function isLobbyistKind(kind: string): boolean {
  return LOBBYIST_KINDS.has(kind.trim().toLowerCase());
}

// Internal: compute majority strictly from base influence (no adjacency bonuses).
function computeBaseMajority(state: GameState, key: string): { leaderId: string | null; max: number; isTie: boolean } {
  const perPlayer: Record<string, number> = (state.influenceByCoord?.[key]) ?? {};
  let leaderId: string | null = null;
  let max = 0;
  let tie = false;
  for (const p of state.players) {
    const v = perPlayer[p.id] ?? 0;
    if (v > max) { leaderId = p.id; max = v; tie = false; }
    else if (v === max && v !== 0) { tie = true; leaderId = null; }
  }
  if (max === 0) return { leaderId: null, max: 0, isTie: false };
  return { leaderId, max, isTie: tie };
}

export function computeMajority(state: GameState, coord: HexCoord): MajorityResult {
  const key = coordKey(coord);
  const baseByPlayerId: Record<string, number> = {};
  const lobbyBonusByPlayerId: Record<string, number> = {};
  const totalByPlayerId: Record<string, number> = {};

  for (const p of state.players) {
    baseByPlayerId[p.id] = state.influenceByCoord?.[key]?.[p.id] ?? 0;
    lobbyBonusByPlayerId[p.id] = 0;
  }

  // Adjacency: controlled lobbyists grant +1 on adjacent tiles for their controller only.
  const boardCells = (state.board?.cells ?? []);
  const cellByKey = new Map<string, (typeof boardCells)[number]>();
  for (const c of boardCells) cellByKey.set(c.key, c);

  for (const n of neighbors(coord)) {
    const nk = coordKey(n);
    const cell = cellByKey.get(nk);
    if (!cell) continue;
    const kind = cell.tile.tile.kind;
    if (!kind || !isLobbyistKind(kind)) continue;
    const baseMaj = computeBaseMajority(state, nk);
    if (baseMaj.leaderId) {
      lobbyBonusByPlayerId[baseMaj.leaderId] = (lobbyBonusByPlayerId[baseMaj.leaderId] ?? 0) + 1;
    }
  }

  // Tally totals and determine leader deterministically in players[] order.
  let leaderId: string | null = null;
  let max = 0;
  let tie = false;
  for (const p of state.players) {
    const total = (baseByPlayerId[p.id] ?? 0) + (lobbyBonusByPlayerId[p.id] ?? 0);
    totalByPlayerId[p.id] = total;
    if (total > max) { leaderId = p.id; max = total; tie = false; }
    else if (total === max && total !== 0) { tie = true; leaderId = null; }
  }

  if (max === 0) {
    return { coordKey: key, baseByPlayerId, lobbyBonusByPlayerId, totalByPlayerId, max: 0, leaderId: null, isTie: false };
  }
  return { coordKey: key, baseByPlayerId, lobbyBonusByPlayerId, totalByPlayerId, max, leaderId, isTie: tie };
}

export function getControlLeaderId(state: GameState, coord: HexCoord): string | null {
  return computeMajority(state, coord).leaderId;
}
