import { z } from 'zod';
import type { ActionEnvelope, GameSnapshot } from '@bc/core';

// Local schema mirrors the core expectation; strictly validate amount in a safe range.
const GrantPayload = z.object({ amount: z.number().int().min(1).max(3), reason: z.string().optional() });

type EconomyRegistry = { registerStateInitializer: (f: () => unknown) => void; registerAction: (s: { type: string; payload: import('zod').ZodTypeAny; requiresExpansionId?: string }) => void; registerReducer: (h: (snapshot: GameSnapshot, action: ActionEnvelope) => { next: GameSnapshot } | null) => void; };
export const economyExpansion = {
  id: 'economy',
  version: '0.0.1',
  register(reg: EconomyRegistry) {
    // Register a stable state slice under state.extensions.economy
    reg.registerStateInitializer(() => ({ credits: 0, lastActionAt: null as number | null, audit: [] as Array<{ id: string; at: number; note: string }> }));

    // Action schema + requirement that the 'economy' expansion is enabled.
    reg.registerAction({ type: 'exp.economy.grantCredit', payload: GrantPayload, requiresExpansionId: 'economy' });

    // Reducer handles only our action type and returns a new state snapshot
    reg.registerReducer((snapshot: GameSnapshot, action: ActionEnvelope) => {
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