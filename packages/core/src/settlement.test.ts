import { describe, it, expect } from 'vitest';
import { createEngine } from './expansion/engine';
import type { GameSnapshot, PlacedTile } from './protocol';
import { coordKey } from './coord';
import { computeRoundSettlement, settleRound } from './settlement';

const players = [ { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' } ];

function placed(kind: string, q: number, r: number, production: Record<string, number>): { key: string; tile: PlacedTile } {
  const key = coordKey({ q, r });
  return { key, tile: { tile: { id: `${kind}-${key}`, kind, production }, coord: { q, r }, placedBy: 'sys', placedAtTurn: 1 } };
}

function withBoard(snap: GameSnapshot, cells: Array<{ key: string; tile: PlacedTile }>) {
  (snap.state as any).board = { cells };
  return snap;
}

function withInfluence(snap: GameSnapshot, inf: Record<string, Record<string, number>>) {
  (snap.state as any).influenceByCoord = inf;
  return snap;
}

describe('round settlement (Rule 10.1 + 13)', () => {
  it('no influence => no payout', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: [], seed: 'seed-x', players });
    withBoard(snap, [placed('resort', 0, 0, { domestic: 5 })]);
    withInfluence(snap, {});
    const r = computeRoundSettlement(snap.state as any);
    expect(r.payoutsByPlayerId.p1.domestic).toBe(0);
    expect(r.payoutsByPlayerId.p2.domestic).toBe(0);
    expect(r.noiseDelta.domestic).toBe(0);
    const s2 = settleRound(snap.state as any).nextState as any;
    expect(s2.resourcesByPlayerId.p1.domestic).toBe(0);
    expect(s2.resourcesByPlayerId.p2.domestic).toBe(0);
    expect(s2.noise.domestic).toBe(0);
  });

  it('clear majority => full payout to leader', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's2', mode: 'hotseat', enabledExpansions: [], seed: 'seed-y', players });
    const cell = placed('resort', 1, 1, { domestic: 4 });
    withBoard(snap, [cell]);
    withInfluence(snap, { [cell.key]: { p1: 2, p2: 1 } });
    const r = computeRoundSettlement(snap.state as any);
    expect(r.payoutsByPlayerId.p1.domestic).toBe(4);
    expect(r.payoutsByPlayerId.p2.domestic).toBe(0);
    expect(r.noiseDelta.domestic).toBe(0);
  });

  it('tie split with remainder -> floor split + remainder to noise', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's3', mode: 'hotseat', enabledExpansions: [], seed: 'seed-z', players });
    const cell = placed('resort', 2, 2, { domestic: 5 });
    withBoard(snap, [cell]);
    withInfluence(snap, { [cell.key]: { p1: 2, p2: 2 } });
    const r = computeRoundSettlement(snap.state as any);
    expect(r.payoutsByPlayerId.p1.domestic).toBe(2);
    expect(r.payoutsByPlayerId.p2.domestic).toBe(2);
    expect(r.noiseDelta.domestic).toBe(1);
    const s2 = settleRound(snap.state as any).nextState as any;
    expect(s2.resourcesByPlayerId.p1.domestic).toBe(2);
    expect(s2.resourcesByPlayerId.p2.domestic).toBe(2);
    expect(s2.noise.domestic).toBe(1);
  });

  it('tie split with no remainder -> equal distribution, noise unchanged', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's4', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a1', players });
    const cell = placed('resort', 3, 3, { domestic: 6 });
    withBoard(snap, [cell]);
    withInfluence(snap, { [cell.key]: { p1: 1, p2: 1 } });
    const r = computeRoundSettlement(snap.state as any);
    expect(r.payoutsByPlayerId.p1.domestic).toBe(3);
    expect(r.payoutsByPlayerId.p2.domestic).toBe(3);
    expect(r.noiseDelta.domestic).toBe(0);
  });

  it('multiple tiles and resources aggregate correctly', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's5', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a2', players });
    const c1 = placed('factory', 0, 1, { domestic: 4, media: 1 });
    const c2 = placed('media', 1, 0, { media: 3 });
    withBoard(snap, [c1, c2]);
    withInfluence(snap, { [c1.key]: { p1: 1, p2: 1 }, [c2.key]: { p2: 2 } });
    const r = computeRoundSettlement(snap.state as any);
    // c1 domestic 4 split -> 2/2; c1 media 1 split -> 0/0 +1 noise; c2 media 3 to p2
    expect(r.payoutsByPlayerId.p1.domestic).toBe(2);
    expect(r.payoutsByPlayerId.p2.domestic).toBe(2);
    expect(r.payoutsByPlayerId.p1.media).toBe(0);
    expect(r.payoutsByPlayerId.p2.media).toBe(3);
    expect(r.noiseDelta.media).toBe(1);
  });

  it('determinism: computing settlement twice yields identical deltas', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's6', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a3', players });
    const cell = placed('resort', 4, 4, { domestic: 7 });
    withBoard(snap, [cell]);
    withInfluence(snap, { [cell.key]: { p1: 3, p2: 3 } });
    const r1 = computeRoundSettlement(snap.state as any);
    const r2 = computeRoundSettlement(snap.state as any);
    expect(r1).toEqual(r2);
  });

  it('engine: settlement runs automatically at round wrap', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's7', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a4', players });
    const cell = placed('resort', 5, 5, { domestic: 5 });
    withBoard(snap, [cell]);
    withInfluence(snap, { [cell.key]: { p1: 1, p2: 1 } }); // tie -> 2 each, +1 noise
    // Drive phases so both players pass; we only need to be in awaitingPass to pass.
    (snap.state as any).phase = 'awaitingPass';
    // p1 passes (no settlement yet)
    let r = engine.applyAction(snap, { sessionId: 's7', actionId: 'pass1', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('pass1 failed');
    snap = r.next;
    expect((snap.state as any).round).toBe(1);
    expect((snap.state as any).resourcesByPlayerId.p1.domestic).toBe(0);
    // p2 passes -> wraps to p1 and settlement should apply
    (snap.state as any).phase = 'awaitingPass';
    r = engine.applyAction(snap, { sessionId: 's7', actionId: 'pass2', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any);
    if (!r.ok) throw new Error('pass2 failed');
    snap = r.next;
    expect((snap.state as any).round).toBe(2);
    expect((snap.state as any).resourcesByPlayerId.p1.domestic).toBe(2);
    expect((snap.state as any).resourcesByPlayerId.p2.domestic).toBe(2);
    expect((snap.state as any).noise.domestic).toBe(1);
  });
});

