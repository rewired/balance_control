import { z } from 'zod';
import type { ActionEnvelope, GameSnapshot } from '@bc/core';
import type { MeasureState } from '@bc/core';
import { createMeasureState, takeMeasure, playMeasure } from '@bc/core';

// Local schema mirrors the core expectation; strictly validate amount in a safe range.
const GrantPayload = z.object({ amount: z.number().int().min(1).max(3), reason: z.string().optional() });

type EconomyRegistry = {
  registerStateInitializer: (f: () => unknown) => void;
  registerAction: (s: { type: string; payload: import('zod').ZodTypeAny; requiresExpansionId?: string }) => void;
  registerReducer: (h: (snapshot: GameSnapshot, action: ActionEnvelope) => { next: GameSnapshot } | null) => void;
  registerResourceDef?: (def: { id: string; label: string; iconKey?: string }) => void;
  registerHook?: (hook: string, handler: (snapshot: GameSnapshot) => GameSnapshot) => void;
};

export const economyExpansion = {
  id: 'economy',
  version: '0.0.1',
  register(reg: EconomyRegistry) {
    // Register economy resource id for this session (enabled only when economy is in enabledExpansions).
    reg.registerResourceDef?.({ id: 'economy', label: 'Economy', iconKey: 'factory' });

    // Append a small, deterministic set of economy tiles to the initial supply at session create.
    // Deterministic ordering: appended to the end preserves base supply order.
    reg.registerHook?.('onSessionCreate', (snapshot: GameSnapshot) => {
      if (!(snapshot?.config?.enabledExpansions ?? []).includes('economy')) return snapshot as GameSnapshot;
      const tiles = (snapshot.state as unknown as { supply: { tiles: Array<{ id: string; kind: string; production?: Record<string, number> }> } }).supply.tiles as Array<{ id: string; kind: string; production?: Record<string, number> }>;
      const nextTiles = [...tiles];
      for (let i = 1; i <= 5; i++) {
        nextTiles.push({ id: `econ-${i.toString().padStart(4,'0')}`, kind: 'economy-1', production: { economy: 1 } });
      }
      const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, supply: { ...(snapshot.state as unknown as { supply: { tiles: Array<{ id: string; kind: string; production?: Record<string, number> }> } }).supply, tiles: nextTiles } } } as GameSnapshot;
      return next;
    });

    // Register a stable state slice under state.extensions.economy
    reg.registerStateInitializer(() => ({ credits: 0, lastActionAt: null as number | null, audit: [] as Array<{ id: string; at: number; note: string }>, measures: undefined as unknown as MeasureState }));

    // Initialize economy measures using core helpers on session create
    reg.registerHook?.('onSessionCreate', (snapshot: GameSnapshot) => {
      if (!(snapshot?.config?.enabledExpansions ?? []).includes('economy')) return snapshot as GameSnapshot;
      const playerIds = (snapshot.state.players as any[]).map((p) => p.id as string);
      const deckIds = ['ECO_M_ONE_SHOT','ECO_M_UNTIL_NEXT_TURN','ECO_M_UNTIL_END_NEXT_ROUND'];
      const seed = (snapshot.config as any).seed as string;
      const ms = createMeasureState({ playerIds, deckIds, seed });
      const econ = { ...(snapshot.state.extensions['economy'] as any), measures: ms };
      const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), economy: econ } } } as GameSnapshot;
      return next;
    });

    // Action schema + requirement that the 'economy' expansion is enabled.
    reg.registerAction({ type: 'exp.economy.grantCredit', payload: GrantPayload, requiresExpansionId: 'economy' });
    reg.registerAction({ type: 'exp.economy.measure.take', payload: z.object({ index: z.union([z.literal(0), z.literal(1), z.literal(2)]) }), requiresExpansionId: 'economy' });
    reg.registerAction({ type: 'exp.economy.measure.play', payload: z.object({ measureId: z.string() }), requiresExpansionId: 'economy' });

    // Reducer handles only our action type and returns a new state snapshot
    reg.registerReducer((snapshot: GameSnapshot, action: ActionEnvelope) => {
      if (action.type === 'exp.economy.measure.take') {
        const idx = (action.payload as any).index as 0 | 1 | 2;
        const econ: any = (snapshot.state.extensions['economy'] as any);
        const ms = takeMeasure(econ.measures as MeasureState, action.actorId, idx);
        const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), economy: { ...econ, measures: ms } } } } as GameSnapshot;
        return { next };
      }
      if (action.type === 'exp.economy.measure.play') {
        const id = (action.payload as any).measureId as string;
        const econ: any = (snapshot.state.extensions['economy'] as any);
        const ms = playMeasure(econ.measures as MeasureState, action.actorId, id);
        const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), economy: { ...econ, measures: ms } } } } as GameSnapshot;
        return { next };
      }
      if (action.type !== 'exp.economy.grantCredit') return null;
      const { amount, reason } = GrantPayload.parse(action.payload);
      const now = Date.now();
      const next: GameSnapshot = { ...snapshot };
      type EconState = { credits: number; lastActionAt: number | null; audit: Array<{ id: string; at: number; note: string }> };
      const econ: EconState = (snapshot.state.extensions['economy'] as EconState) ?? { credits: 0, lastActionAt: null, audit: [] };
      econ.credits += amount;
      econ.lastActionAt = now;
      econ.audit = [...(econ.audit ?? []), { id: action.actionId, at: now, note: reason ?? 'grant' }].slice(-50);
      next.state = { ...snapshot.state, extensions: { ...(snapshot.state?.extensions ?? {}), economy: econ } };
      return { next };
    });
  },
};
