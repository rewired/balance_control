// Protocol primitives and Zod schemas for runtime validation.
// Keep this package free of any server/client dependencies.
import { z } from 'zod';

// Resource registry: extensible, session-scoped (session snapshot stores enabled resources).
export type ResourceId = string;
export const ResourceDefSchema = z.object({ id: z.string(), label: z.string(), iconKey: z.string().optional() });
export type ResourceDef = z.infer<typeof ResourceDefSchema>;


export const ActionEnvelopeSchema = z.object({
  sessionId: z.string(),
  actionId: z.string(),
  type: z.string(), // namespaced, e.g., 'core.noop', 'core.placeTile', 'exp.some.id'
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
    'CELL_OCCUPIED',
    'DUPLICATE_TILE_ID',
    'SUPPLY_EMPTY',
    'HAND_FULL',
    'TILE_NOT_IN_HAND',
    'WRONG_TURN_PHASE',
    'PLACEMENT_ALREADY_DONE',
    'ACTION_NOT_ALLOWED_IN_PHASE',
    'DUPLICATE_RESOURCE_ID',
    'TILE_NOT_FOUND',
    'INFLUENCE_CAP_REACHED',
    'INSUFFICIENT_INFLUENCE',
    'HOOK_REJECTED',
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
  payload: z.unknown().optional(),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export const GameConfigSchema = z.object({
  mode: z.literal('hotseat'),
  enabledExpansions: z.array(z.string()),
  // Deterministic seed for supply generation. Part of snapshot config to ensure replayability.
  seed: z.string(),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

// Player model kept minimal and future-proof.
export const PlayerSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  name: z.string().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

// Axial hex coordinates: (q, r). We keep only axial in state for stability; cube can be derived if needed.
export const HexCoordSchema = z.object({ q: z.number().int(), r: z.number().int() });
export type HexCoord = z.infer<typeof HexCoordSchema>;

export const TileSchema = z.object({ id: z.string(), kind: z.string().min(1), production: z.record(z.string(), z.number().int().nonnegative()).default({}) });
export type Tile = z.infer<typeof TileSchema>;

export const PlacedTileSchema = z.object({
  tile: TileSchema,
  coord: HexCoordSchema,
  placedBy: z.string(),
  placedAtTurn: z.number().int().positive(),
});
export type PlacedTile = z.infer<typeof PlacedTileSchema>;

export const GameStateSchema = z.object({
  // Turn phase lifecycle: awaitingPlacement -> awaitingAction -> awaitingPass
  // Enforces one placement per turn, then at most one other action, then mandatory pass.
  phase: z.enum(["awaitingPlacement","awaitingAction","awaitingPass"]),
  // Round model in addition to absolute turn counter.
  // round starts at 1 and increments when the active player wraps to the round start player.
  round: z.number().int().positive().default(1),
  // turnInRound counts 1..N across players for the current round; resets to 1 on new round.
  turnInRound: z.number().int().positive().default(1),
  // Index of the player who started the current round (stable within a round).
  roundStartPlayerIndex: z.number().int().nonnegative().default(0),
  // Turn invariants:
  // - Exactly one active player at all times (players.length >= 1 => 0 <= activePlayerIndex < players.length).
  // - activePlayerIndex always valid.
  // - turn increments only on turn-ending actions (placeTile does NOT end turn in MVP).
  players: z.array(PlayerSchema),
  activePlayerIndex: z.number().int().nonnegative(),
  // Convenience mirror of the active player's id for snapshot consumers.
  activePlayerId: z.string().optional(),
  turn: z.number().int().positive(),
  // Board stored as JSON-stable entry array for deterministic lookups and replay stability.
  board: z.object({
    cells: z.array(z.object({ key: z.string(), tile: PlacedTileSchema })),
  }),
  // Resource registry and per-player resource pools.
  resources: z.object({ registry: z.array(ResourceDefSchema) }),
  resourcesByPlayerId: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).default({}),
  // Influence markers per tile: key is CoordKey (q,r), value is per-player counts.
  // Invariants: counts are integers in [0,3]; entries only for existing tiles.
  influenceByCoord: z.record(z.string(), z.record(z.string(), z.number().int().min(0).max(3))).default({}),
  // Active effects (minimal layer). Effects are evaluated deterministically and expired by engine ticks.
  effects: z.array(z.object({
    id: z.string(),
    source: z.object({ kind: z.enum(['measure','overlay','system']), ref: z.string().optional() }),
    ownerPlayerId: z.string().optional(),
    createdAtTurn: z.number().int().positive(),
    expires: z.object({ atTurn: z.number().int().positive().optional(), atRound: z.number().int().positive().optional(), atNextTurnOfPlayerId: z.string().optional() }),
    modifiers: z.object({
      blockActionTypes: z.array(z.string()).optional(),
      costDeltaByResourceId: z.record(z.string(), z.number().int()).optional(),
    }).optional(),
  })).default([]),
  // Tile supply and per-player hands. Invariants:
  // - drawIndex in [0, tiles.length]
  // - a tile id exists in exactly one location (undrawn supply, some player's hand, or board)
  // - hands exist for all players
  supply: z.object({ tiles: z.array(TileSchema), drawIndex: z.number().int().nonnegative(), openDiscard: z.array(TileSchema).default([]) }),\n  pendingPlacementTile: TileSchema.nullable().optional(),
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






