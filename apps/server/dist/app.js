import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ActionEnvelopeSchema, GameSnapshotSchema, applyAction, createInitialState } from '@bc/core';
export const sessionStore = new Map();
export function createApp() {
    const app = express();
    app.use(express.json());
    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });
    // Create a new session; optional list of enabled expansions.
    const CreateSessionSchema = z.object({ enabledExpansions: z.array(z.string()).optional() });
    app.post('/api/session', (req, res) => {
        const parsed = CreateSessionSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.flatten() });
        }
        const sessionId = nanoid();
        const snapshot = createInitialState({ sessionId, mode: 'hotseat', enabledExpansions: parsed.data.enabledExpansions ?? [] });
        sessionStore.set(sessionId, snapshot);
        res.json({ sessionId });
    });
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: { origin: true },
    });
    io.on('connection', (socket) => {
        // On connect, send a basic hello with version/capabilities.
        socket.emit('server:hello', { version: '0.0.0', capabilities: ['snapshot', 'actions'] });
        socket.on('client:join', ({ sessionId }) => {
            const snapshot = sessionStore.get(sessionId);
            if (!snapshot) {
                socket.emit('server:error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
                return;
            }
            void socket.join(sessionId);
            // Validate snapshot before sending (defensive during development).
            const checked = GameSnapshotSchema.parse(snapshot);
            socket.emit('server:snapshot', checked);
        });
        socket.on('client:dispatch', (payload) => {
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
            const res = applyAction(snapshot, action);
            if (!res.ok) {
                socket.emit('server:error', { code: res.error.code, message: res.error.message });
                return;
            }
            const next = res.next;
            sessionStore.set(action.sessionId, next);
            io.to(action.sessionId).emit('server:snapshot', GameSnapshotSchema.parse(next));
            // Additionally emit each event as a stream item.
            for (const e of res.events) {
                io.to(action.sessionId).emit('server:event', e);
            }
        });
    });
    return { app, httpServer, io };
}
//# sourceMappingURL=app.js.map