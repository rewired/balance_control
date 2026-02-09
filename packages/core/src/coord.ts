// Coordinate utilities for axial hex coordinates.
// The key format "q,r" is stable and must not change; it underpins deterministic snapshots and replay.
export function coordKey(coord: { q: number; r: number }): string {
  return `${coord.q},${coord.r}`;
}

export function isCoordEqual(a: { q: number; r: number }, b: { q: number; r: number }): boolean {
  return a.q === b.q && a.r === b.r;
}
// Axial hex neighbor deltas (pointy-top, q,r)
const NEIGHBORS: Array<{ dq: number; dr: number }> = [
  { dq: 1, dr: 0 },
  { dq: 1, dr: -1 },
  { dq: 0, dr: -1 },
  { dq: -1, dr: 0 },
  { dq: -1, dr: 1 },
  { dq: 0, dr: 1 },
];

export function neighbors(coord: { q: number; r: number }): Array<{ q: number; r: number }> {
  return NEIGHBORS.map((d) => ({ q: coord.q + d.dq, r: coord.r + d.dr }));
}

export function isAdjacentToAny(coord: { q: number; r: number }, occupiedKeys: Set<string>): boolean {
  for (const n of neighbors(coord)) {
    if (occupiedKeys.has(${n.q},)) return true;
  }
  return false;
}
