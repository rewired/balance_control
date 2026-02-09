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
export const ServerErrorSchema = z.object({
    code: z.enum(['VALIDATION_ERROR', 'UNKNOWN_ACTION', 'SESSION_NOT_FOUND', 'NOT_AUTHORIZED', 'EXPANSION_NOT_ENABLED', 'EXPANSION_NOT_FOUND', 'EXPANSION_DEPENDENCY_MISSING', 'ACTION_SCHEMA_NOT_REGISTERED']),
    message: z.string(),
    details: z.unknown().optional(),
});
export const EventLogEntrySchema = z.object({
    id: z.string(),
    at: z.number(),
    kind: z.string(),
    message: z.string(),
});
export const GameConfigSchema = z.object({
    mode: z.literal('hotseat'),
    enabledExpansions: z.array(z.string()),
});
export const GameStateSchema = z.object({
    // Minimal placeholder, expansion ready.
    extensions: z.record(z.string(), z.unknown()),
});
export const GameSnapshotSchema = z.object({
    sessionId: z.string(),
    revision: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    config: GameConfigSchema,
    state: GameStateSchema,
    log: z.array(EventLogEntrySchema),
});
//# sourceMappingURL=index.js.map