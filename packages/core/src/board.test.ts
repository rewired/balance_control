import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';
import { coordKey } from './coord';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('board + core.placeTile', () => {
  it('places tile in empty coord and updates board', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a', players });
    // draw first tile
    let res = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!res.ok) throw new Error('draw failed');
    snap = res.next;
    const tileId = ((snap.state.hands as any)['p1'] as Array<{id:string}>)[0].id;
    const action: ActionEnvelope = {
      sessionId: 's1', actionId: 't1', type: 'core.placeTile',
      payload: { coord: { q: 0, r: 0 }, tileId }, actorId: 'p1'
    } as any;
    res = engine.applyAction(snap, action);
    expect(res.ok).toBe(true);
    if (res.ok) {
      snap = res.next;
      const k = coordKey({ q: 0, r: 0 });
      const cell = snap.state.board.cells.find((c) => c.key === k)!;
      expect(cell.tile.tile.id).toBe(tileId);
      expect(cell.tile.placedBy).toBe('p1');
      expect(cell.tile.placedAtTurn).toBe(1);
    }
  });

  it('rejects placement in occupied coord with CELL_OCCUPIED', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-b', players });
    // draw and place at (1,1)
    const r1 = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!r1.ok) throw new Error('draw failed');
    snap = r1.next;
    const firstId = ((snap.state.hands as any)['p1'] as Array<{id:string}>)[0].id;
    const p1: ActionEnvelope = { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tileId: firstId }, actorId: 'p1' } as any;
    const r2 = engine.applyAction(snap, p1);
    if (!r2.ok) throw new Error('expected ok');
    snap = r2.next;
    // draw second tile and try to place at occupied coord
    const r3 = engine.applyAction(snap, { sessionId: 's1', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!r3.ok) throw new Error('draw failed');
    snap = r3.next;
    const secondId = ((snap.state.hands as any)['p1'] as Array<{id:string}>)[0]?.id ?? ((snap.state.hands as any)['p1'] as Array<{id:string}>)[0].id;
    const p2: ActionEnvelope = { sessionId: 's1', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tileId: secondId }, actorId: 'p1' } as any;
    const r4 = engine.applyAction(snap, p2);
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.error.code).toBe('CELL_OCCUPIED');
  });

  it('rejects placement by non-active player (NOT_ACTIVE_PLAYER)', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-c', players });
    // Draw for active player only
    const r1 = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!r1.ok) throw new Error('draw failed');
    snap = r1.next;
    // Non-active attempts to place (even without a tile)
    const bad: ActionEnvelope = { sessionId: 's1', actionId: 'b1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: 'nope' }, actorId: 'p2' } as any;
    const r = engine.applyAction(snap, bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ACTIVE_PLAYER');
  });

  it('rejects duplicate tile id (DUPLICATE_TILE_ID)', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-d', players });
    // draw and place first tile
    let r = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    if (!r.ok) throw new Error('draw failed');
    snap = r.next;
    const firstId = ((snap.state.hands as any)['p1'] as Array<{id:string}>)[0].id;
    r = engine.applyAction(snap, { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 2, r: 2 }, tileId: firstId }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('place failed');
    snap = r.next;
    // Force duplicate scenario by putting same id back into hand (test-only)
    ((snap.state.hands as any)['p1'] as Array<{id:string;kind:string}>).push({ id: firstId, kind: 'generic-a' });
    const dup = engine.applyAction(snap, { sessionId: 's1', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 3, r: 3 }, tileId: firstId }, actorId: 'p1' } as any);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('DUPLICATE_TILE_ID');
  });

  it('snapshot stays JSON-serializable', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-e', players });
    const s = JSON.stringify(snap);
    const back = JSON.parse(s);
    expect(back.sessionId).toBe('s1');
    expect(Array.isArray(back.state.board.cells)).toBe(true);
  });
});