import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app';
const { app, httpServer } = createApp();
/**
 * Server authority: this process is the source of truth for game state.
 * The client sends intents; the server validates/applies them (rules TBD).
 * This file intentionally implements only minimal HTTP + Socket.IO bootstrapping.
 * When SERVE_STATIC=1, the server also serves the built client from apps/client/dist.
 */
const port = Number(process.env['PORT']) || 3001;
// Optionally serve the built client (preview:full)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');
if (process.env['SERVE_STATIC'] === '1') {
    if (fs.existsSync(clientDist)) {
        app.use(express.static(clientDist));
        app.get('/', (_req, res) => {
            res.sendFile(path.join(clientDist, 'index.html'));
        });
    }
    else {
        console.warn(`[server] SERVE_STATIC=1 but ${clientDist} not found; skipping static serving`);
    }
}
httpServer.listen(port, () => {
    // Touch core to prove workspace linking works.
    console.log(`[server] listening on http://localhost:${port} `);
});
//# sourceMappingURL=main.js.map