import { describe, it, expect } from 'vitest';
import type { ExpansionModule } from './expansion/types';
import { createEngine } from './index';

const expA: ExpansionModule = { id: 'ra', version: '0.0.0', register(reg) {
  reg.registerResourceDef?.({ id: 'dup', label: 'Dup' });
} };
const expB: ExpansionModule = { id: 'rb', version: '0.0.0', register(reg) {
  reg.registerResourceDef?.({ id: 'dup', label: 'DupAgain' });
} };

describe('resource registry duplicates', () => {
  it('fails session create on duplicate resource id', () => {
    const engine = createEngine({ expansions: [expA, expB] });
    expect(() => engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['ra','rb'], seed: 's', players: [{id:'p1'},{id:'p2'}] } as any)).toThrowError(/DUPLICATE_RESOURCE_ID:dup/);
  });
});

