import type { ActionEnvelope, GameSnapshot, ResourceDef } from '../protocol';

export interface ActionSchema {
  type: string;
  payload: import('zod').ZodTypeAny; // runtime Zod schema
  requiresExpansionId?: string;
}

export type HookName =
  | 'onEngineInit'
  | 'onSessionCreate'
  | 'onBeforeActionValidate'
  | 'onValidateAction'
  | 'onApplyAction'
  | 'onAfterAction'
  | 'onSnapshot';

export type HookHandler = (...args: unknown[]) => unknown;

export interface ExpansionModule {
  id: string; // lowercase ascii, stable
  version: string;
  requires?: string[];
  register(registry: ExpansionRegistry): void;
}

export interface ExpansionRegistry {
  registerAction(schema: ActionSchema): void;
  registerReducer(
    handler: (
      snapshot: GameSnapshot,
      action: ActionEnvelope
    ) => { next: GameSnapshot; events?: Array<{ id: string; at: number; kind: string; message: string }> } | null
  ): void;
  registerHook(hook: HookName, handler: HookHandler): void;
  registerStateInitializer(initializer: () => unknown): void;
  registerEventMapper?(mapper: (entry: unknown) => unknown): void;
  // 0009: resource definitions extension point (session-scoped application)
  registerResourceDef?(def: ResourceDef): void;
}

export type EngineHooks = { [K in HookName]: HookHandler[] };

export interface EngineRegistries {
  actions: Map<string, ActionSchema>;
  reducers: ((snapshot: GameSnapshot, action: ActionEnvelope) => { next: GameSnapshot; events?: Array<{ id: string; at: number; kind: string; message: string }> } | null)[];
  hooks: EngineHooks;
  stateInitializers: Map<string, () => unknown>;
  resourceDefProviders: Map<string, ResourceDef[]>; // per-expansion defs collected during register(); applied per-session
}

export interface EngineOptions {
  expansions: ExpansionModule[];
  isTileGloballyPlaceable?: (state: import('../protocol').GameState, tile: { id: string; kind: string; production: Record<string, number> }) => boolean;
  isPlacementLegal?: (state: import('../protocol').GameState, tile: { id: string; kind: string; production: Record<string, number> }, coord: { q: number; r: number }) => boolean;
}