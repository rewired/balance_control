import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { io as ioc, type Socket } from 'socket.io-client';
import type { GameSnapshot } from '@bc/core';

function once<T>(emitter: Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (data: T) => resolve(data)));
}

describe('server placeTile integration', () => {
  it('creates session and applies draw -> place', async () => {
    const { app, httpServer } = createApp();
    await new Promise<void>((r) => httpServer.listen(0, r));
    const address: import('node:net').AddressInfo | string | null = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] });
    expect(res.status).toBe(200);

    const socket = ioc(`http://localhost:${port}`);
    await once(socket, 'connect');
    socket.emit('client:join', { sessionId: res.body.sessionId });
    await once<GameSnapshot>(socket, 'server:snapshot');

    // Draw at turn start (7.1)
    socket.emit('client:dispatch', { sessionId: res.body.sessionId, actionId: 'd1', type: 'core.drawTile', payload: {}, actorId: 'p1' });
    const afterDraw = await once<GameSnapshot>(socket, 'server:snapshot');
    expect((afterDraw.state as any).pendingPlacementTile).toBeTruthy();

    // Place immediately (7.1)
    socket.emit('client:dispatch', { sessionId: res.body.sessionId, actionId: 'p1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' });
    const afterPlace = await once<GameSnapshot>(socket, 'server:snapshot');
    const cell = afterPlace.state.board.cells.find((c: { key: string }) => c.key === '0,0');
    expect(cell).toBeTruthy();

    socket.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});