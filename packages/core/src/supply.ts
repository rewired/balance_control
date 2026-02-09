// Deterministic tile supply generation for core engine.
// We implement a tiny seeded PRNG (LCG) and derive stable tile ids/kinds.
// Determinism matters for replay and debugging: given the same config.seed, the
// generated supply is identical.

export type SupplyGenConfig = { seed: string; count?: number };

function hashSeed(str: string): number {
  // Simple FNV-1a 32-bit for seed hashing; stable across runtimes.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function lcg(seed: number) {
  // 32-bit LCG: X_{n+1} = (aX + c) mod 2^32
  let x = seed >>> 0;
  const a = 1664525;
  const c = 1013904223;
  return () => (x = (a * x + c) >>> 0);
}

export function generateSupplyTiles(cfg: SupplyGenConfig): { id: string; kind: string }[] {
  const kinds = ['generic-a', 'generic-b', 'generic-c'] as const;
  const n = cfg.count ?? 30; // MVP size
  const rnd = lcg(hashSeed(cfg.seed));
  const tiles = [] as { id: string; kind: string }[];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    const kind = kinds[r % kinds.length]!;
    const id = `t${(i + 1).toString().padStart(4, '0')}`;
    tiles.push({ id, kind });
  }
  return tiles;
}
