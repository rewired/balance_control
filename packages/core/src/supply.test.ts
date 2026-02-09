import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('supply + draw & immediate placement (no hands)', () => {
  it('draw at turn start sets pending tile and increments index', () => {
    const engine = createEngine({ expansions: [] });
    let snapMutable = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-1', players });
    const s0 = snapMutable.state.supply;
    const r = engine.applyAction(snapMutable, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      snapMutable = r.next;
      const s1 = snapMutable.state.supply;
      expect(s1.drawIndex).toBe(s0.drawIndex + 1);
      expect((snapMutable.state as any).pendingPlacementTile?.id).toBeTruthy();
    }
  });

  it('placeTile places the drawn tile and clears pending', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-xyz', players });
    const r = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!r.ok) throw new Error('draw failed');
    snap = r.next;
    const place: ActionEnvelope = { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any;
    const r2 = engine.applyAction(snap, place);
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const next = r2.next;
      expect((next.state as any).pendingPlacementTile).toBeNull();
      const has = next.state.board.cells.some((c) => c.key === '0,0');
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

  it('supply empty -> draw moves directly to awaitingAction (7.1 entfällt)', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'tiny', players });
    (snap.state as any).supply.drawIndex = (snap.state as any).supply.tiles.length;
    const r = engine.applyAction(snap, { sessionId: 's1', actionId: 'dX', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.next.state as any).phase).toBe('awaitingAction');
  });

  it('unplaceable -> goes to openDiscard -> draws next', () => {
    // Use placeability hook to force top tile as unplaceable
    const engine = createEngine({ expansions: [], isTileGloballyPlaceable: (state, tile) => {
      const supply: any = (state as any).supply; const idx = supply.drawIndex; const top = supply.tiles[idx];
      if (top && top.id === tile.id) return false; return true;
    }});
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-2', players });
    const beforeId = snap.state.supply.tiles[0].id;
    const r = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const next = r.next;
      const disc = (next.state as any).supply.openDiscard as Array<{id:string}>;
      expect(disc.some(t => t.id === beforeId)).toBe(true);
      expect((next.state as any).pendingPlacementTile?.id).not.toBe(beforeId);
    }
  });
});

