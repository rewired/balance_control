// Protocol primitives and Zod schemas for runtime validation.
// Keep this package free of any server/client dependencies.
import { z } from 'zod';

export const ActionEnvelopeSchema = z.object({
  sessionId: z.string(),
  actionId: z.string(),
  type: z.string(), // namespaced, e.g., 'core.noop', 'exp.some.id'
  payload: z.unknown(),
  actorId: z.string(),
  clientTime: z.number().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ActionEnvelope = z.infer<typeof ActionEnvelopeSchema>;

export const ServerErrorSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'UNKNOWN_ACTION',
    'SESSION_NOT_FOUND',
    'NOT_AUTHORIZED',
    'EXPANSION_NOT_ENABLED',
    'EXPANSION_NOT_FOUND',
    'EXPANSION_DEPENDENCY_MISSING',
    'ACTION_SCHEMA_NOT_REGISTERED',
    'ACTOR_NOT_ALLOWED',
    'NOT_ACTIVE_PLAYER',
  ]),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ServerError = z.infer<typeof ServerErrorSchema>;

export const EventLogEntrySchema = z.object({
  id: z.string(),
  at: z.number(),
  kind: z.string(),
  message: z.string(),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export const GameConfigSchema = z.object({
  mode: z.literal('hotseat'),
  enabledExpansions: z.array(z.string()),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

// Player model kept minimal and future-proof.
export const PlayerSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  name: z.string().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const GameStateSchema = z.object({
  // Core turn system state lives here.
  // Invariants:
  // - Exactly one active player at all times.
  // - activePlayerIndex is always valid.
  // - turn increments only on turn-ending actions.
  players: z.array(PlayerSchema),
  activePlayerIndex: z.number().int().nonnegative(),
  turn: z.number().int().positive(),
  // Expansion-owned state slots.
  extensions: z.record(z.string(), z.unknown()),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const GameSnapshotSchema = z.object({
  sessionId: z.string(),
  revision: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  config: GameConfigSchema,
  state: GameStateSchema,
  log: z.array(EventLogEntrySchema),
});
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;

// Typed socket event interfaces for Socket.IO (shared across client/server)
export interface ServerToClientEvents {
  'server:hello': (data: { version: string; capabilities: string[] }) => void;
  'server:snapshot': (snapshot: GameSnapshot) => void;
  'server:event': (entry: EventLogEntry) => void;
  'server:error': (err: ServerError) => void;
}

export interface ClientToServerEvents {
  'client:join': (payload: { sessionId: string }) => void;
  'client:dispatch': (action: ActionEnvelope) => void;
}

export type InterServerEvents = Record<string, never>;
export type SocketData = Record<string, never>;