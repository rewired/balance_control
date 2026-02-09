import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { z } from 'zod';
import type { ActionEnvelope, GameSnapshot, ServerError } from '@bc/core';

const HelloSchema = z.object({ version: z.string(), capabilities: z.array(z.string()) });

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [hello, setHello] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<ServerError | null>(null);

  // Connect socket once
  useEffect(() => {
    const s = io(); // same origin in dev due to Vite proxy for /socket.io
    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('server:hello', (data: unknown) => {
      const parsed = HelloSchema.safeParse(data);
      if (parsed.success) setHello(`${parsed.data.version} [${parsed.data.capabilities.join(', ')}]`);
    });
    s.on('server:snapshot', (snap) => setSnapshot(snap));
    s.on('server:error', (e) => setError(e));
    return () => { s.close(); };
  }, []);

  // Create a session via HTTP, then join over socket.
  async function createAndJoin() {
    setError(null);
    const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabledExpansions: [] }) });
    const body = await res.json();
    setSessionId(body.sessionId);
    socket?.emit('client:join', { sessionId: body.sessionId });
  }

  function dispatchNoop() {
    if (!sessionId) return;
    const action: ActionEnvelope = {
      sessionId,
      actionId: Math.random().toString(36).slice(2),
      type: 'core.noop',
      payload: null,
      actorId: 'hotseat',
    };
    socket?.emit('client:dispatch', action);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>BALANCE // CONTROL</h1>

      <section>
        <p>Socket: {connected ? 'connected' : 'disconnected'}</p>
        <p>Hello: {hello || '...'}</p>
        <button onClick={createAndJoin}>Create session</button>
        {sessionId && <p>sessionId: {sessionId}</p>}
      </section>

      <section>
        <button onClick={dispatchNoop} disabled={!sessionId}>Send noop action</button>
      </section>

      <section>
        <h3>Snapshot</h3>
        {snapshot ? (
          <ul>
            <li>revision: {snapshot.revision}</li>
            <li>enabledExpansions: {snapshot.config.enabledExpansions.join(', ') || '(none)'}</li>
          </ul>
        ) : (
          <p>(no snapshot)</p>
        )}
      </section>

      <section>
        <h3>Event log (last 5)</h3>
        <ul>
          {snapshot?.log.slice(-5).map((e) => (
            <li key={e.id}>{new Date(e.at).toLocaleTimeString()} • {e.kind} • {e.message}</li>
          ))}
        </ul>
      </section>

      {error && (
        <section>
          <h3>Error</h3>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}