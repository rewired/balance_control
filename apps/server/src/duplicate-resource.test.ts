import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

// Mock expansions loader to supply two expansions that register the same resource id
vi.mock('./expansions', async () => {
  const mod = await vi.importActual<typeof import('./expansions')>('./expansions');
  const expA = { id: 'ra', version: '0.0.0', register(reg: any) { reg.registerResourceDef?.({ id: 'dup', label: 'Dup' }); } };
  const expB = { id: 'rb', version: '0.0.0', register(reg: any) { reg.registerResourceDef?.({ id: 'dup', label: 'DupAgain' }); } };
  return {
    ...mod,
    loadAvailableExpansions: () => [expA as any, expB as any],
  };
});

afterEach(() => {
  vi.resetModules();
});

describe('server maps duplicate resource engine error', () => {
  it('POST /api/session returns DUPLICATE_RESOURCE_ID', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/session').send({ enabledExpansions: ['ra','rb'], players: [{id:'p1'},{id:'p2'}] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_RESOURCE_ID');
    expect(res.body.details?.id).toBe('dup');
  });
});

