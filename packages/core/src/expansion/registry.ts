import type { ResourceDef } from '../protocol';
import type { EngineRegistries,  ExpansionRegistry, HookHandler, HookName, ActionSchema, EngineOptions } from './types';

export function createEmptyRegistries(): EngineRegistries {
  return {
    actions: new Map<string, ActionSchema>(),
    reducers: [],
    hooks: {
      onEngineInit: [],
      onSessionCreate: [],
      onBeforeActionValidate: [],
      onValidateAction: [],
      onApplyAction: [],
      onAfterAction: [],
      onSnapshot: [],
    },
    stateInitializers: new Map<string, () => unknown>(),
    resourceDefProviders: new Map<string, ResourceDef[]>(),
  };
}

export function buildEngineRegistries(opts: EngineOptions): EngineRegistries {
  const seen = new Set<string>();
  const registries = createEmptyRegistries();
  const sorted = [...opts.expansions].sort((a, b) => a.id.localeCompare(b.id));
  for (const exp of sorted) {
    if (!/^[-a-z0-9]+$/.test(exp.id)) throw new Error(`Invalid expansion id: ${exp.id}`);
    if (seen.has(exp.id)) throw new Error(`Duplicate expansion id: ${exp.id}`);
    seen.add(exp.id);

    const registry: ExpansionRegistry = {
      registerAction: (schema) => {
        if (registries.actions.has(schema.type)) throw new Error(`Duplicate action type: ${schema.type}`);
        registries.actions.set(schema.type, schema);
      },
      registerReducer: (handler) => { registries.reducers.push(handler); },
      registerHook: (hook: HookName, handler: HookHandler) => { registries.hooks[hook].push(handler); },
      registerStateInitializer: (initializer: () => unknown) => {
        if (registries.stateInitializers.has(exp.id)) throw new Error(`State initializer already set for ${exp.id}`);
        registries.stateInitializers.set(exp.id, initializer);
      },
      registerEventMapper: () => {},
      registerResourceDef: (def) => { const arr = registries.resourceDefProviders.get(exp.id) ?? []; arr.push(def); registries.resourceDefProviders.set(exp.id, arr); },
    };

    exp.register(registry);
  }
  return registries;
}


