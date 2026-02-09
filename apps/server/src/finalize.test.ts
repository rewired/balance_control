import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, sessionStore } from './app';
import type { PlacedTile } from '@bc/core';

function placed(kind: string, q: number, r: number, production: Record<string, number>): { key: string; tile: PlacedTile } {
  const key = `${q},${r}`;
  return { key, tile: { tile: { id: `${kind}-${key}`, kind, production }, coord: { q, r }, placedBy: 'sys', placedAtTurn: 1 } } as any;
}

describe('POST /api/finalize', () => {
  it('applies final settlement to the session and broadcasts snapshot', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players: [{id:'p1'},{id:'p2'}] });
    expect(res.status).toBe(200);
    const sessionId = res.body.sessionId as string;

    const snap = sessionStore.get(sessionId)!;
    const cell = placed('resort', 9, 9, { domestic: 5 });
    (snap.state as any).board = { cells: [cell] };
    (snap.state as any).influenceByCoord = { [cell.key]: { p1: 2, p2: 2 } };

    const fin = await request(app).post('/api/finalize').send({ sessionId });
    expect(fin.status).toBe(200);
    const after = sessionStore.get(sessionId)!;
    const p1 = (after.state as any).resourcesByPlayerId.p1.domestic;
    const p2 = (after.state as any).resourcesByPlayerId.p2.domestic;
    const noise = (after.state as any).noise.domestic;
    expect(p1).toBe(2);
    expect(p2).toBe(2);
    expect(noise).toBe(1);
  });
});
