import { describe, it, expect } from 'vitest';
import { createEngine } from './index';
import type { ActionEnvelope } from './index';
import { coordKey } from './coord';

const players = [ { id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' } ];

describe('board + core.placeTile', () => {
  it('places tile in empty coord and updates board', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-a', players });
    // draw pending tile for placement
    let r = engine.applyAction(snap, { sessionId: 's1', actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('draw failed');
    snap = r.next;
    const action: ActionEnvelope = { sessionId: 's1', actionId: 't1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' } as any;
    const res = engine.applyAction(snap, action);
    expect(res.ok).toBe(true);
    if (res.ok) {
      snap = res.next;
      const k = coordKey({ q: 0, r: 0 });
      const cell = snap.state.board.cells.find((c) => c.key === k)!;
      expect(cell.tile.placedBy).toBe('p1');
      expect(cell.tile.placedAtTurn).toBe(1);
    }
  });

  it('rejects placement in occupied coord with CELL_OCCUPIED', () => {
    const engine = createEngine({ expansions: [] });
    let snap = engine.createInitialSnapshot({ sessionId: 's1', mode: 'hotseat', enabledExpansions: [], seed: 'seed-b', players });
    // p1 place at (1,1)
    let r = engine.applyAction(snap, { sessionId: 's1', actionId: 'd0', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('draw');
    r = engine.applyAction(r.next, { sessionId: 's1', actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 } }, actorId: 'p1' } as any);
    if (!r.ok) throw new Error('expected ok');
    snap = r.next;
    // Move to awaitingPass and pass to p2
    (snap.state as any).phase = 'awaitingPass';
    const pass = engine.applyAction(snap, { sessionId: 's1', actionId: 'pass1', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    if (!pass.ok) throw new Error('pass failed');
    snap = pass.next;
    // p2 draw then attempt to place at occupied coord
    let d2 = engine.applyAction(snap, { sessionId: 's1', actionId: 'd2', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any);
    if (!d2.ok) throw new Error('p2 draw');
    const p2Try: ActionEnvelope = { sessionId: 's1', actionId: 'p2', type: 'core.placeTile', payload: { coord: { q: 1, r: 1 } }, actorId: 'p2' } as any;
    const r4 = engine.applyAction(d2.next, p2Try);
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.error.code).toBe('CELL_OCCUPIED');
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