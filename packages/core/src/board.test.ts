import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';
import { coordKey } from './coord';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('board + core.placeTile', () => {
  it('places tile in empty coord and updates board', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const action: ActionEnvelope = {
      sessionId: 's1', actionId: 't1', type: 'core.placeTile',
      payload: { coord: { q: 0, r: 0 }, tile: { id: 'tile1', kind: 'generic' } }, actorId: 'p1'
    };
    const res = engine.applyAction(snap, action);
    expect(res.ok).toBe(true);
    if (res.ok) {
      snap = res.next;
      const k = coordKey({ q: 0, r: 0 });
      const cell = snap.state.board.cells.find((c) => c.key === k)!;
      expect(cell.tile.tile.id).toBe('tile1');
      expect(cell.tile.placedBy).toBe('p1');
      expect(cell.tile.placedAtTurn).toBe(1);
    }
  });

  it('rejects placement in occupied coord with CELL_OCCUPIED', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const a1: ActionEnvelope = { sessionId: 's1', actionId: 'a1', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tile: { id: 't1', kind: 'generic' } }, actorId: 'p1' };
    const r1 = engine.applyAction(snap, a1);
    if (r1.ok) snap = r1.next; else throw new Error('expected ok');
    const a2: ActionEnvelope = { sessionId: 's1', actionId: 'a2', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 }, tile: { id: 't2', kind: 'generic' } }, actorId: 'p1' };
    const r2 = engine.applyAction(snap, a2);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('CELL_OCCUPIED');
  });

  it('rejects placement by non-active player (NOT_ACTIVE_PLAYER)', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const bad: ActionEnvelope = { sessionId: 's1', actionId: 'b1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tile: { id: 't3', kind: 'generic' } }, actorId: 'p2' };
    const r = engine.applyAction(snap, bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ACTIVE_PLAYER');
  });

  it('rejects duplicate tile id (DUPLICATE_TILE_ID)', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const a1: ActionEnvelope = { sessionId: 's1', actionId: 'x1', type: 'core.placeTile', payload: { coord: { q: 3, r: 3 }, tile: { id: 'dupe', kind: 'generic' } }, actorId: 'p1' };
    const r1 = engine.applyAction(snap, a1);
    if (r1.ok) snap = r1.next; else throw new Error('expected ok');
    const a2: ActionEnvelope = { sessionId: 's1', actionId: 'x2', type: 'core.placeTile', payload: { coord: { q: 4, r: 4 }, tile: { id: 'dupe', kind: 'generic' } }, actorId: 'p1' };
    const r2 = engine.applyAction(snap, a2);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('DUPLICATE_TILE_ID');
  });

  it('snapshot stays JSON-serializable', () => {
    const engine = createEngine({ expansions: [] });
    const snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], players });
    const s = JSON.stringify(snap);
    const back = JSON.parse(s);
    expect(back.sessionId).toBe('s1');
    expect(Array.isArray(back.state.board.cells)).toBe(true);
  });
});