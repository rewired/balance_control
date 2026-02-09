import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ActionEnvelopeSchema, GameSnapshotSchema, createEngine, getControlLeaderId, computeMajority } from '@bc/core';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData, GameState } from '@bc/core';
import { loadAvailableExpansions } from './expansions';

export type Session = z.infer<typeof GameSnapshotSchema>;
export const sessionStore: Map<string, Session> = new Map();

const engine = createEngine({ expansions: loadAvailableExpansions() });

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Example debug endpoint: control check on demand using core.getControlLeaderId
  // GET /api/control?sessionId=...&q=0&r=0
  app.get('/api/control', (req, res) => {
    const ControlQuerySchema = z.object({ sessionId: z.string(), q: z.coerce.number().int(), r: z.coerce.number().int() });
    const parsed = ControlQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() });
    const snap = sessionStore.get(parsed.data.sessionId);
    if (!snap) return res.status(404).json({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    const leaderId = getControlLeaderId(snap.state as GameState, { q: parsed.data.q, r: parsed.data.r });
    // For richer debug info you may also inspect computeMajority totals
    const majority = computeMajority(snap.state as GameState, { q: parsed.data.q, r: parsed.data.r });
    return res.json({ leaderId, max: majority.max, isTie: majority.isTie, totalByPlayerId: majority.totalByPlayerId });
  });

  const CreateSessionSchema = z.object({
    enabledExpansions: z.array(z.string()).optional(),
    players: z.array(z.object({ id: z.string(), name: z.string().optional() })).min(2).max(6).optional(),    seed: z.string().optional(),
  });
  app.post('/api/session', (req, res) => {
    const parsed = CreateSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.flatten() });
    }
    const requested = parsed.data.enabledExpansions ?? [];
    const seed = parsed.data.seed ?? nanoid();

    // Players: strict validation above; generate defaults when omitted.
    const players = parsed.data.players && parsed.data.players.length > 0
      ? parsed.data.players
      : [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' },
        ];

    const all = loadAvailableExpansions();
    const available = new Map(all.map((e) => [e.id, true as const]));
    for (const id of requested) {
      if (!available.has(id)) return res.status(400).json({ code: 'EXPANSION_NOT_FOUND', message: `Unknown expansion id: ${id}` });
    }
    const deps = new Map(all.map((e) => [e.id, e.requires ?? []]));
    for (const id of requested) {
      for (const r of deps.get(id) ?? []) {
        if (!requested.includes(r)) return res.status(400).json({ code: 'EXPANSION_DEPENDENCY_MISSING', message: `Missing dependency: ${id} requires ${r}` });
      }
    }

    const sessionId = nanoid();
    try {
      const snapshot = engine.createInitialSnapshot({ sessionId, mode: 'hotseat', enabledExpansions: requested, seed, players });
      sessionStore.set(sessionId, snapshot);
      res.json({ sessionId });
    } catch (err) {
      const message = (err as Error)?.message ?? '';
      if (message.startsWith('DUPLICATE_RESOURCE_ID:')) {
        const id = message.split(':')[1] ?? '';
        return res.status(400).json({ code: 'DUPLICATE_RESOURCE_ID', message: `Duplicate resource id: ${id}`, details: { id } });
      }
      // Fallback: surface as validation error to keep contract simple
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: message || 'Failed to create session' });
    }
  });

  const httpServer = createServer(app);
  const io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> = new Server(httpServer, { cors: { origin: true } });

  io.on('connection', (socket) => {
    socket.emit('server:hello', { version: '0.0.0', capabilities: ['snapshot', 'actions'] });

    socket.on('client:join', ({ sessionId }: { sessionId: string }) => {
      const snapshot = sessionStore.get(sessionId);
      if (!snapshot) return void socket.emit('server:error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      void socket.join(sessionId);
      socket.emit('server:snapshot', GameSnapshotSchema.parse(snapshot));
    });

    socket.on('client:dispatch', (payload: unknown) => {
      const parsed = ActionEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('server:error', { code: 'VALIDATION_ERROR', message: 'Invalid action', details: parsed.error.flatten() });
        return;
      }
      const action = parsed.data;
      const snapshot = sessionStore.get(action.sessionId);
      if (!snapshot) {
        socket.emit('server:error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
        return;
      }
      // Actor enforcement: actorId must belong to a known session player.
      const players: Array<{ id: string }> = (snapshot.state as { players: Array<{ id: string }> }).players ?? [];
      const allowed = players.some((p) => p.id === action.actorId);
      if (!allowed) {
        socket.emit('server:error', { code: 'ACTOR_NOT_ALLOWED', message: 'actorId not part of this session' });
        return;
      }
      const res = engine.applyAction(snapshot, action);
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.emit('server:error', { code: res.error.code as any, message: res.error.message });
        return;
      }
      const next = res.next;
      sessionStore.set(action.sessionId, next);
      io.to(action.sessionId).emit('server:snapshot', GameSnapshotSchema.parse(next));
      for (const e of res.events) io.to(action.sessionId).emit('server:event', e);
    });
  });

  return { app, httpServer, io };
}




