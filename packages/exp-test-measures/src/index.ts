import { z } from 'zod';
import type { ActionEnvelope, GameSnapshot, MeasureState } from '@bc/core';
import { createMeasureState, takeMeasure, playMeasure } from '@bc/core';

type Registry = {
  registerStateInitializer: (f: () => unknown) => void;
  registerAction: (s: { type: string; payload: import('zod').ZodTypeAny; requiresExpansionId?: string }) => void;
  registerReducer: (h: (snapshot: GameSnapshot, action: ActionEnvelope) => { next: GameSnapshot } | null) => void;
  registerHook?: (hook: string, handler: (snapshot: GameSnapshot) => GameSnapshot) => void;
};

export const testMeasuresExpansion = {
  id: 'test',
  version: '0.0.1',
  register(reg: Registry) {
    reg.registerStateInitializer(() => ({ measures: undefined as unknown as MeasureState }));
    reg.registerHook?.('onSessionCreate', (snapshot: GameSnapshot) => {
      if (!(snapshot?.config?.enabledExpansions ?? []).includes('test')) return snapshot as GameSnapshot;
      const playerIds = (snapshot.state.players as any[]).map((p) => p.id as string);
      // Dummy deck ids â€” purely for contract tests
      const deckIds = ['TEST_M_A','TEST_M_B','TEST_M_C','TEST_M_D'];
      const seed = (snapshot.config as any).seed as string;
      const ms = createMeasureState({ playerIds, deckIds, seed });
      const ext = { ...(snapshot.state.extensions['test'] as any), measures: ms };
      const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), test: ext } } } as GameSnapshot;
      return next;
    });
        reg.registerHook?.('onApplyAction', (snapshot: GameSnapshot) => {
      const ext: any = (snapshot.state.extensions['test'] as any);
      if (ext?.measures && snapshot.log?.length && snapshot.log[snapshot.log.length - 1]?.kind === 'core.placeTile') {
        ext.measures.playedThisRoundByPlayerId[(snapshot.state.activePlayerId as string) ?? 'p1'] = true;
      }
      return snapshot;
    });
    reg.registerAction({ type: 'exp.test.measure.take', payload: z.object({ index: z.union([z.literal(0), z.literal(1), z.literal(2)]) }), requiresExpansionId: 'test' });
    reg.registerAction({ type: 'exp.test.measure.play', payload: z.object({ id: z.string() }), requiresExpansionId: 'test' });
    reg.registerReducer((snapshot: GameSnapshot, action: ActionEnvelope) => {
      if (action.type === 'exp.test.measure.take') {
        const idx = (action.payload as any).index as 0 | 1 | 2;
        const ext: any = (snapshot.state.extensions['test'] as any);
        const ms = takeMeasure(ext.measures as MeasureState, action.actorId, idx);
        const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), test: { ...ext, measures: ms } } } } as GameSnapshot;
        return { next };
      }
      if (action.type === 'exp.test.measure.play') {
        const id = (action.payload as any).id as string;
        const ext: any = (snapshot.state.extensions['test'] as any);
        const ms = playMeasure(ext.measures as MeasureState, action.actorId, id);
        const next: GameSnapshot = { ...snapshot, state: { ...snapshot.state, extensions: { ...(snapshot.state.extensions as any), test: { ...ext, measures: ms } } } } as GameSnapshot;
        return { next };
      }
      return null;
    });
  },
};


