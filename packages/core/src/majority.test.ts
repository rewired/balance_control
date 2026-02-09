import { describe, it, expect } from 'vitest';
import type { GameState, HexCoord, PlacedTile } from './protocol';
import { computeMajority, getControlLeaderId } from './majority';

const players = [ { id: 'p1', name: 'A', index: 0 }, { id: 'p2', name: 'B', index: 1 } ];

function makeState(partial: Partial<GameState>): GameState {
  // Minimal, but valid GameState for tests that don't rely on engine lifecycle.
  const base: any = {
    phase: 'awaitingAction',
    round: 1,
    turnInRound: 1,
    roundStartPlayerIndex: 0,
    players,
    activePlayerIndex: 0,
    activePlayerId: players[0].id,
    turn: 1,
    board: { cells: [] },
    resources: { registry: [] },
    resourcesByPlayerId: {},
    influenceByCoord: {},
    effects: [],
    supply: { tiles: [], drawIndex: 0, openDiscard: [] },
    pendingPlacementTile: null,
    extensions: {},
  };
  return { ...base, ...partial } as GameState;
}

function cell(key: string, kind: string, q: number, r: number): { key: string; tile: PlacedTile } {
  return { key, tile: { tile: { id: `${kind}-${key}` , kind, production: {} }, coord: { q, r }, placedBy: 'sys', placedAtTurn: 1 } };
}

describe('majority service', () => {
  it('1) no influence on target => leader null, tie false, max 0', () => {
    const state = makeState({
      board: { cells: [cell('0,0','resort',0,0)] },
      influenceByCoord: {},
    });
    const r = computeMajority(state, { q: 0, r: 0 });
    expect(r.max).toBe(0);
    expect(r.leaderId).toBeNull();
    expect(r.isTie).toBe(false);
  });

  it('2) simple leader without lobbyists (p1=2, p2=1)', () => {
    const key = '1,1';
    const state = makeState({ board: { cells: [cell(key,'resort',1,1)] }, influenceByCoord: { [key]: { p1: 2, p2: 1 } } });
    const r = computeMajority(state, { q: 1, r: 1 });
    expect(r.leaderId).toBe('p1');
    expect(r.isTie).toBe(false);
    expect(r.max).toBe(2);
  });

  it('3) tie on base (p1=2, p2=2)', () => {
    const key = '2,2';
    const state = makeState({ board: { cells: [cell(key,'resort',2,2)] }, influenceByCoord: { [key]: { p1: 2, p2: 2 } } });
    const r = computeMajority(state, { q: 2, r: 2 });
    expect(r.leaderId).toBeNull();
    expect(r.isTie).toBe(true);
    expect(r.max).toBe(2);
  });

  it('4) lobbyist bonus applies: neighbor lobbyist controlled by p1 breaks tie', () => {
    const target = { q: 3, r: 3 } satisfies HexCoord;
    const targetKey = '3,3';
    const lobbyKey = '4,3';
    const state = makeState({
      board: { cells: [cell(targetKey,'resort',3,3), cell(lobbyKey,'lobbyist',4,3)] },
      influenceByCoord: {
        [targetKey]: { p1: 1, p2: 1 },
        [lobbyKey]: { p1: 2, p2: 1 }, // p1 controls lobbyist
      },
    });
    const r = computeMajority(state, target);
    expect(r.baseByPlayerId.p1).toBe(1);
    expect(r.lobbyBonusByPlayerId.p1).toBe(1);
    expect(r.totalByPlayerId.p1).toBe(2);
    expect(r.leaderId).toBe('p1');
    expect(r.isTie).toBe(false);
  });

  it('5) lobbyist does NOT apply when tied/uncontrolled', () => {
    const targetKey = '0,1';
    const lobbyKey = '1,1'; // neighbor (1,0) to (0,1)? neighbors are (1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)
    const state = makeState({
      board: { cells: [cell(targetKey,'resort',0,1), cell(lobbyKey,'lobbyist',1,1)] },
      influenceByCoord: {
        [targetKey]: { p1: 1, p2: 1 }, // tie base
        [lobbyKey]: { p1: 1, p2: 1 }, // tie lobbyist => no control
      },
    });
    const r = computeMajority(state, { q: 0, r: 1 });
    expect(r.lobbyBonusByPlayerId.p1).toBe(0);
    expect(r.lobbyBonusByPlayerId.p2).toBe(0);
    expect(r.leaderId).toBeNull();
    expect(r.isTie).toBe(true);
  });

  it('6) multiple lobbyists stack (+2)', () => {
    const targetKey = '10,10';
    const l1 = '11,10'; // (1,0)
    const l2 = '10,11'; // (0,1)
    const state = makeState({
      board: { cells: [cell(targetKey,'resort',10,10), cell(l1,'lobbyist',11,10), cell(l2,'lobbyist',10,11)] },
      influenceByCoord: {
        [targetKey]: { p1: 1, p2: 1 },
        [l1]: { p1: 2, p2: 0 },
        [l2]: { p1: 1, p2: 0 },
      },
    });
    const r = computeMajority(state, { q: 10, r: 10 });
    expect(r.lobbyBonusByPlayerId.p1).toBe(2);
    expect(r.totalByPlayerId.p1).toBe(3);
    expect(r.leaderId).toBe('p1');
    expect(r.isTie).toBe(false);
  });

  it('getControlLeaderId mirrors computeMajority.leaderId', () => {
    const key = '5,5';
    const state = makeState({ board: { cells: [cell(key,'resort',5,5)] }, influenceByCoord: { [key]: { p2: 2 } } });
    expect(getControlLeaderId(state, { q: 5, r: 5 })).toBe('p2');
  });
});



