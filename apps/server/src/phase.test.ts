import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { io as ioc, type Socket } from 'socket.io-client';
import type { GameSnapshot, ServerError } from '@bc/core';

function once<T>(emitter: Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (data: T) => resolve(data)));
}

describe('server turn phase enforcement', () => {
  it('enforces draw -> place -> action -> pass (7.1/7.2)', async () => {
    const { app, httpServer } = createApp();
    await new Promise<void>((r) => httpServer.listen(0, r));
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players: [{ id: 'p1' }, { id: 'p2' }] });
    const sessionId = res.body.sessionId as string;

    const socket = ioc(`http://localhost:${port}`);
    await once(socket, 'connect');
    socket.emit('client:join', { sessionId });
    await once<GameSnapshot>(socket, 'server:snapshot');

    // Place before draw -> error (must draw first)
    let errP = once<ServerError>(socket, 'server:error');
    socket.emit('client:dispatch', { sessionId, actionId: 'p0', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 } }, actorId: 'p1' });
    let err = await errP; expect(err.code).toBe('ACTION_NOT_ALLOWED_IN_PHASE');

    // Pass before action -> error (must complete placement and one action)
    errP = once<ServerError>(socket, 'server:error');
    socket.emit('client:dispatch', { sessionId, actionId: 'pass', type: 'core.passTurn', payload: {}, actorId: 'p1' });
    err = await errP; expect(err.code).toBe('WRONG_TURN_PHASE');

    socket.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});