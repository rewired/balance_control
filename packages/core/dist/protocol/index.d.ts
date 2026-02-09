import { z } from 'zod';
export declare const ActionEnvelopeSchema: z.ZodObject<{
    sessionId: z.ZodString;
    actionId: z.ZodString;
    type: z.ZodString;
    payload: z.ZodUnknown;
    actorId: z.ZodString;
    clientTime: z.ZodOptional<z.ZodNumber>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ActionEnvelope = z.infer<typeof ActionEnvelopeSchema>;
export declare const ServerErrorSchema: z.ZodObject<{
    code: z.ZodEnum<{
        VALIDATION_ERROR: "VALIDATION_ERROR";
        UNKNOWN_ACTION: "UNKNOWN_ACTION";
        SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
        NOT_AUTHORIZED: "NOT_AUTHORIZED";
        EXPANSION_NOT_ENABLED: "EXPANSION_NOT_ENABLED";
        EXPANSION_NOT_FOUND: "EXPANSION_NOT_FOUND";
        EXPANSION_DEPENDENCY_MISSING: "EXPANSION_DEPENDENCY_MISSING";
        ACTION_SCHEMA_NOT_REGISTERED: "ACTION_SCHEMA_NOT_REGISTERED";
    }>;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type ServerError = z.infer<typeof ServerErrorSchema>;
export declare const EventLogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    at: z.ZodNumber;
    kind: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;
export declare const GameConfigSchema: z.ZodObject<{
    mode: z.ZodLiteral<"hotseat">;
    enabledExpansions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export declare const GameStateSchema: z.ZodObject<{
    extensions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type GameState = z.infer<typeof GameStateSchema>;
export declare const GameSnapshotSchema: z.ZodObject<{
    sessionId: z.ZodString;
    revision: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    config: z.ZodObject<{
        mode: z.ZodLiteral<"hotseat">;
        enabledExpansions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    state: z.ZodObject<{
        extensions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    log: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        at: z.ZodNumber;
        kind: z.ZodString;
        message: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
export interface ServerToClientEvents {
    'server:hello': (data: {
        version: string;
        capabilities: string[];
    }) => void;
    'server:snapshot': (snapshot: GameSnapshot) => void;
    'server:event': (entry: EventLogEntry) => void;
    'server:error': (err: ServerError) => void;
}
export interface ClientToServerEvents {
    'client:join': (payload: {
        sessionId: string;
    }) => void;
    'client:dispatch': (action: ActionEnvelope) => void;
}
export type InterServerEvents = Record<string, never>;
export type SocketData = Record<string, never>;
