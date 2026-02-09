import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, sessionStore } from './app';
import { io as ioc, type Socket } from 'socket.io-client';
import type { GameSnapshot, ServerError } from '@bc/core';
import type { AddressInfo } from 'node:net';

function once<T>(emitter: Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (data: T) => resolve(data)));
}

describe('server session creation', () => {
  it('POST /api/session returns a sessionId', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/session').send({ enabledExpansions: [] });
    expect(res.status).toBe(200);
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.sessionId.length).toBeGreaterThan(0);
  });

  it('accepts explicit players and stores them', async () => {
    const { app } = createApp();
    const players = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }];
    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players });
    expect(res.status).toBe(200);
    const snap = sessionStore.get(res.body.sessionId)!;
    expect(snap.state.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(snap.state.turn).toBe(1);
  });
});

describe('server actorId enforcement', () => {
  it('rejects dispatch from unknown actorId with ACTOR_NOT_ALLOWED', async () => {
    const { app, httpServer } = createApp();
    await new Promise<void>((r) => httpServer.listen(0, r));
    const address = httpServer.address() as AddressInfo;
    const port = address.port;

    // Create session with known players
    const players = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }];
    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players });
    const sessionId = res.body.sessionId as string;

    const socket = ioc(`http://localhost:${port}`);
    await once(socket, 'connect');

    socket.emit('client:join', { sessionId });
    await once<GameSnapshot>(socket, 'server:snapshot');

    const errP = once<ServerError>(socket, 'server:error');
    socket.emit('client:dispatch', { sessionId, actionId: 'x', type: 'core.noop', payload: null, actorId: 'unknown' });
    const err = await errP;
    expect(err.code).toBe('ACTOR_NOT_ALLOWED');

    socket.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});