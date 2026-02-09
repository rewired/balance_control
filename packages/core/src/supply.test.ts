import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('supply + draw + place from hand', () => {
  it('draw moves from supply to hand and increments index', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-1', players });
    const s0 = snap.state.supply;
    const hand0 = (snap.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
    expect(s0.drawIndex).toBe(0);
    expect(hand0.length).toBe(0);
    const a: ActionEnvelope = { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' };
    const r = engine.applyAction(snap, a);
    expect(r.ok).toBe(true);
    if (r.ok) {
      snap = r.next;
      const s1 = snap.state.supply;
      const hand1 = (snap.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
      expect(s1.drawIndex).toBe(1);
      expect(hand1.length).toBe(1);
    }
  });

  it('placeTile requires tileId in hand and removes it when placed', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-xyz', players });
    const draw: ActionEnvelope = { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' };
    const r1 = engine.applyAction(snap, draw);
    if (!r1.ok) throw new Error('draw failed');
    snap = r1.next;
    const hand = (snap.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
    const tileId = hand[0].id;
    const place: ActionEnvelope = { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId }, actorId: 'p1' } as any;
    const r2 = engine.applyAction(snap, place);
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const next = r2.next;
      const handAfter = (next.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
      expect(handAfter.length).toBe(0);
      const has = next.state.board.cells.some((c) => c.key === '0,0' && c.tile.tile.id === tileId);
      expect(has).toBe(true);
    }
  });

  it('deterministic supply from seed', () => {
    const engine = createEngine({ expansions: [] });
    const s1 = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'fixed', players });
    const s2 = engine.createInitialSnapshot({ sessionId: 's2', mode: 'hotseat', enabledExpansions: [], seed: 'fixed', players });
    expect(s1.state.supply.tiles[0].id).toBe(s2.state.supply.tiles[0].id);
    expect(s1.state.supply.tiles[0].kind).toBe(s2.state.supply.tiles[0].kind);
  });

  it('errors: supply empty and hand full and tile not in hand', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'tiny', players });
    // Simulate supply empty by jumping drawIndex
    (snap.state as any).supply.drawIndex = (snap.state as any).supply.tiles.length;
    const empty = engine.applyAction(snap, { sessionId: 's1', actionId: 'dX', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe('SUPPLY_EMPTY');

    // hand full (limit 5)
    snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'hand-full', players });
    for (let i = 0; i < 5; i++) {
      const res = engine.applyAction(snap, { sessionId: 's1', actionId: `d${i}`, type: 'core.drawTile', payload: {}, actorId: 'p1' });
      if (res.ok) snap = res.next; else throw new Error('unexpected');
    }
    const full = engine.applyAction(snap, { sessionId: 's1', actionId: 'd6', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe('HAND_FULL');

    // tile not in hand
    const notInHand = engine.applyAction(snap, { sessionId: 's1', actionId: 'pX', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tileId: 'nope' }, actorId: 'p1' } as any);
    expect(notInHand.ok).toBe(false);
    if (!notInHand.ok) expect(notInHand.error.code).toBe('TILE_NOT_IN_HAND');
  });
});