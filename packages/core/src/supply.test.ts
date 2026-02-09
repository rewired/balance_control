import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('supply + draw + place from hand', () => {
  it('draw moves from supply to hand and increments index', () => {
    const engine = createEngine({ expansions: [] });
    let snapMutable = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-1', players }); // eslint-disable-line prefer-const
    // Start: awaitingPlacement; place first tile to allow draw
    const first = ((snapMutable.state.hands as any)['p1'] as Array<{ id: string; kind: string }>)[0].id;
    let r = engine.applyAction(snapMutable, { sessionId: 's1', actionId: 'p0', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: first }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('place failed');
    snapMutable = r.next;
    const s0 = snapMutable.state.supply; const hand0 = (snapMutable.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
    const a: ActionEnvelope = { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' };
    r = engine.applyAction(snapMutable, a);
    expect(r.ok).toBe(true);
    if (r.ok) {
      snapMutable = r.next;
      const s1 = snapMutable.state.supply;
      const hand1 = (snapMutable.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
      expect(s1.drawIndex).toBe(s0.drawIndex + 1);
      expect(hand1.length).toBe(hand0.length + 1);
    }
  });

  it('placeTile requires tileId in hand and removes it when placed', () => {
    const engine = createEngine({ expansions: [] });
    let snapMutable = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-xyz', players });
    const hand = (snapMutable.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
    const tileId = hand[0].id;
    const place: ActionEnvelope = { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId }, actorId: 'p1' } as any;
    const r2 = engine.applyAction(snapMutable, place);
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const next = r2.next;
      const handAfter = (next.state.hands as any)['p1'] as Array<{ id: string; kind: string }>;
      expect(handAfter.length).toBe(hand.length - 1);
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
    let snapMutable = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'tiny', players });

    // place to reach awaitingAction then simulate empty supply
    const tid = (((snapMutable.state.hands as any)['p1'] as Array<{id:string;kind:string}>)[0]?.id);
    const pl = engine.applyAction(snapMutable, { sessionId: 's1', actionId: 'pZ', type: 'core.placeTile', payload: { coord: { q: 5, r: 5 }, tileId: tid }, actorId: 'p1' } as any);
    if (!pl.ok) throw new Error('place failed');
    snapMutable = pl.next;
    (snapMutable.state as any).supply.drawIndex = (snapMutable.state as any).supply.tiles.length;
    const empty = engine.applyAction(snapMutable, { sessionId: 's1', actionId: 'dX', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe('SUPPLY_EMPTY');

    // hand full (limit 5) -> seed hand and set phase awaitingAction
    snapMutable = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'hand-full', players });
    (snapMutable.state.hands as any)['p1'] = [0,1,2,3,4].map((i) => (snapMutable.state.supply.tiles[i])).slice(0,5);
    (snapMutable.state as any).supply.drawIndex = 5;
    (snapMutable.state as any).phase = 'awaitingAction';
    const full = engine.applyAction(snapMutable, { sessionId: 's1', actionId: 'd6', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe('HAND_FULL');

    // tile not in hand (fresh snapshot at awaitingPlacement)
    const snap2 = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'any', players });
    const notInHand = engine.applyAction(snap2, { sessionId: 's1', actionId: 'pX', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tileId: 'nope' }, actorId: 'p1' } as any);
    expect(notInHand.ok).toBe(false);
    if (!notInHand.ok) expect(notInHand.error.code).toBe('TILE_NOT_IN_HAND');
  });
});






