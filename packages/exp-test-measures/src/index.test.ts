import { describe, it, expect } from 'vitest';
import { createEngine, type ExpansionModule } from '@bc/core';
import { economyExpansion } from '@bc/exp-economy';
import { testMeasuresExpansion } from './index';

const players = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

describe('contract: test measures expansion + engine round reset', () => {
  it('initializes measures for economy + test and resets per-round flags on round advance', () => {
    const engine = createEngine({ expansions: [economyExpansion as unknown as ExpansionModule, testMeasuresExpansion as unknown as ExpansionModule] });
    let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['economy','test'], seed: 'seed-ct', players } as any);
    // extensions initialized
    expect(((s.state.extensions as any).economy?.measures)).toBeTruthy();
    expect(((s.state.extensions as any).test?.measures)).toBeTruthy();

    // Turn 1 (p1): place -> draw -> pass
    const tid1 = (s.state.hands as any)['p1'][0].id as string;
    let r = engine.applyAction(s, { sessionId: 's', actionId: 'p1pl1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: tid1 }, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p1dr', type: 'core.drawTile', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p1ps', type: 'core.passTurn', payload: {}, actorId: 'p1' } as any); if (!r.ok) throw new Error('p1 pass'); s = r.next;

    // Turn 2 (p2): place -> draw -> pass
    const t2 = (s.state.hands as any)['p2'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p2pl', type: 'core.placeTile', payload: { coord: { q: 1, r: 0 }, tileId: t2 }, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p2dr', type: 'core.drawTile', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p2ps', type: 'core.passTurn', payload: {}, actorId: 'p2' } as any); if (!r.ok) throw new Error('p2 pass'); s = r.next;

    // Turn 3 (p3): place -> draw -> pass (new round begins afterwards)
    const t3 = (s.state.hands as any)['p3'][0].id as string;
    r = engine.applyAction(s, { sessionId: 's', actionId: 'p3pl', type: 'core.placeTile', payload: { coord: { q: 2, r: 0 }, tileId: t3 }, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 place');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p3dr', type: 'core.drawTile', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 draw');
    r = engine.applyAction(r.next, { sessionId: 's', actionId: 'p3ps', type: 'core.passTurn', payload: {}, actorId: 'p3' } as any); if (!r.ok) throw new Error('p3 pass'); s = r.next;

    // New round (p1 again): flag from onApplyAction should have been reset by engine when round advanced
    const playedFlag = (((s.state.extensions as any).test.measures.playedThisRoundByPlayerId['p1']) as boolean);
    expect(playedFlag).toBe(false);
  });
});
