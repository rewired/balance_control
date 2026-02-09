import { describe, it, expect } from 'vitest';
import { createEngine, finalizeGame } from './index';
import type { GameSnapshot, PlacedTile } from './protocol';
import { coordKey } from './coord';

const players = [ { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' } ];

function placed(kind: string, q: number, r: number, production: Record<string, number>): { key: string; tile: PlacedTile } {
  const key = coordKey({ q, r });
  return { key, tile: { tile: { id: `${kind}-${key}`, kind, production }, coord: { q, r }, placedBy: 'sys', placedAtTurn: 1 } };
}

describe('finalizeGame: final settlement + onGameEnd hook', () => {
  it('applies settlement and calls onGameEnd hook', () => {
    const engine = createEngine({ expansions: [] });
    const snap: GameSnapshot = engine.createInitialSnapshot({ sessionId: 'sf', mode: 'hotseat', enabledExpansions: [], seed: 'seed-f', players });
    // Prepare board: one tile producing 5 domestic; tie p1=p2 -> 2 each +1 noise
    const cell = placed('resort', 7, 7, { domestic: 5 });
    (snap.state as any).board = { cells: [cell] };
    (snap.state as any).influenceByCoord = { [cell.key]: { p1: 2, p2: 2 } };

    // Register onGameEnd hook that appends a marker to log
    engine.registries.hooks.onGameEnd.push((s: GameSnapshot) => {
      const at = Date.now();
      const mark = { id: `hook-${at}`, at, kind: 'test.onGameEnd', message: 'hook fired' };
      return { ...s, log: [...s.log, mark] } as GameSnapshot;
    });

    const next = finalizeGame(snap, engine.registries);
    const pool1 = (next.state as any).resourcesByPlayerId.p1;
    const pool2 = (next.state as any).resourcesByPlayerId.p2;
    const noise = (next.state as any).noise;
    expect(pool1.domestic).toBe(2);
    expect(pool2.domestic).toBe(2);
    expect(noise.domestic).toBe(1);
    // finalize adds a core log entry and the hook appends another
    const hasFinalize = next.log.some((e) => e.kind === 'core.finalizeGame');
    const hasHook = next.log.some((e) => e.kind === 'test.onGameEnd');
    expect(hasFinalize).toBe(true);
    expect(hasHook).toBe(true);
  });
});

