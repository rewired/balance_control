import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { io as ioc, type Socket } from "socket.io-client";
import type { GameSnapshot } from "@bc/core";

function once<T>(emitter: Socket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, (data: T) => resolve(data)));
}

describe('server seed plumbing', () => {
  it('generates seed when omitted and returns it in snapshot', async () => {
    const { app, httpServer } = createApp();
    await new Promise<void>((r) => httpServer.listen(0, r));
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await request(app).post('/api/session').send({ enabledExpansions: [], players: [{ id: 'p1' }, { id: 'p2' }] });
    expect(res.status).toBe(200);

    const socket = ioc(`http://localhost:${port}`);
    await once(socket, 'connect');
    socket.emit('client:join', { sessionId: res.body.sessionId });
    const snap = await once<GameSnapshot>(socket, 'server:snapshot');
    expect(typeof snap.config.seed).toBe('string');
    expect(snap.config.seed.length).toBeGreaterThan(0);

    socket.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });
});