import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
describe('server session creation', () => {
    it('POST /api/session returns a sessionId', async () => {
        const { app } = createApp();
        const res = await request(app).post('/api/session').send({ enabledExpansions: [] });
        expect(res.status).toBe(200);
        expect(typeof res.body.sessionId).toBe('string');
        expect(res.body.sessionId.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=session.test.js.map