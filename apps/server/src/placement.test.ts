import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { io as ioc, type Socket } from 'socket.io-client';
import type { GameSnapshot } from '@bc/core';

function once<T>(emitter: Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (data: T) => resolve(data)));
}

describe('server placeTile integration', () => {
  it('creates session and applies core.placeTile', async () => {
    const { app, httpServer } = createApp();
    await new Promise<void>((r) => httpServer.listen(0, r));
    const address: import('node:net').AddressInfo | string | null = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] });
    expect(res.status).toBe(200);

    const socket = ioc(`http://localhost:${port}`);
    await once(socket, 'connect');
    socket.emit('client:join', { sessionId: res.body.sessionId });
    const first = await once<GameSnapshot>(socket, 'server:snapshot');

    const action = { sessionId: first.sessionId, actionId: 'place1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tile: { id: 't1', kind: 'generic' } }, actorId: 'p1' };
    socket.emit('client:dispatch', action);
    const next = await once<GameSnapshot>(socket, 'server:snapshot');

    expect(next.revision).toBeGreaterThan(first.revision);
    const cell = next.state.board.cells.find((c: { key: string; tile: { tile: { id: string; kind: string }; placedBy: string; placedAtTurn: number } }) => c.key === '0,0'); expect(cell?.tile.tile.id).toBe('t1');

    socket.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});