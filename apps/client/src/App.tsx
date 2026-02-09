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
  const [enabled, setEnabled] = useState<string[]>([]);

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
    s.on('server:snapshot', (snap) => { setSnapshot(snap); setEnabled(snap.config.enabledExpansions); });
    s.on('server:error', (e) => setError(e));
    return () => { s.close(); };
  }, []);

  // Create a session via HTTP, then join over socket.
  async function createAndJoin() {
    setError(null);
    const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabledExpansions: [], players: [{ id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' }] }) });
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

  function passTurn() {
    if (!sessionId || !snapshot) return;
    const active = snapshot.state.players[snapshot.state.activePlayerIndex];
    const action: ActionEnvelope = {
      sessionId,
      actionId: Math.random().toString(36).slice(2),
      type: 'core.passTurn',
      payload: {},
      actorId: active.id, // hotseat: always act as current active player
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
        <p><small>Enabled expansions: {enabled.join(', ') || '(none)'}</small></p>
        {snapshot ? (
          <>
            <ul>
              <li>revision: {snapshot.revision}</li>
              <li>turn: {snapshot.state.turn}</li>
            </ul>
            <h4>Players</h4>
            <ul>
              {snapshot.state.players.map((p, i) => (
                <li key={p.id} style={{ fontWeight: i === snapshot.state.activePlayerIndex ? 'bold' : 'normal' }}>
                  {i === snapshot.state.activePlayerIndex ? '? ' : ''}{p.name ?? p.id}
                </li>
              ))}
            </ul>
            <button onClick={passTurn}>Pass turn</button>
          </>
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