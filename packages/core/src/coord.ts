// Coordinate utilities for axial hex coordinates.
// The key format "q,r" is stable and must not change; it underpins deterministic snapshots and replay.
export function coordKey(coord: { q: number; r: number }): string {
  return `${coord.q},${coord.r}`;
}

export function isCoordEqual(a: { q: number; r: number }, b: { q: number; r: number }): boolean {
  return a.q === b.q && a.r === b.r;
}