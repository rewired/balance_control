# Balance // Control

Monorepo scaffold for a server‑authoritative game with a React client. Strict TypeScript, ESLint (flat), Prettier, and changelog discipline.

## Prerequisites
- Node.js 18+ (recommended 20+)
- pnpm 10 (this repo sets `"packageManager": "pnpm@10.18.0"`)

## Install
```sh
pnpm install
```
This workspace pre‑approves the `esbuild` binary download via `onlyBuiltDependencies` in `pnpm-workspace.yaml`. If your environment blocked build scripts during install, run:
```sh
pnpm rebuild esbuild
```

## Develop
- Start server (http://localhost:3001) and client (http://localhost:5173) together:
```sh
pnpm dev
```
The client proxies `/health` to the server during dev.

## Build
- All packages:
```sh
pnpm -r build
```
- Client production bundle (Vite):
```sh
pnpm --filter @bc/client build
pnpm --filter @bc/client preview   # optional local preview
```
- Server:
```sh
pnpm --filter @bc/server build
```

## Test & Lint
```sh
pnpm -r test
pnpm -r lint
pnpm format
```

## Project Layout
```
apps/
  client/   # Vite + React + TS (dev proxy to server)
  server/   # Express server with /health; server authority
packages/
  core/     # Deterministic engine primitives (no UI/server deps)
```

## Conventions
- English‑only identifiers.
- Add brief comments where logic exists.
- Update `CHANGELOG.md` with every meaningful change.

## Notes
- Dev ports: client `5173`, server `3001`.
- Vite needs the `esbuild` native binary; this repo already approves it.
## Preview
- Client-only static preview:
```sh
pnpm preview
```
Note: this serves static assets on port 4173 and does not proxy `/health`.

- Full preview with API (server serves built client):
```sh
pnpm preview:full
```
This builds the client and starts the server with `SERVE_STATIC=1`, serving `apps/client/dist` from the server on port 3001. The `/health` endpoint works at the same origin.
## CI / Smoke
One-command verification used locally or in CI:
```sh
pnpm ci:smoke
```
This runs install (frozen lockfile), rebuilds `esbuild` if needed, then recursively runs build, test, and lint for all workspace packages.
## Manual Verification (Sockets)
1. Run dev: `pnpm dev` (server 3001, client 5173)
2. In the client:
   - Click "Create session" → expect a new sessionId to appear.
   - Observe connection status "connected" and hello banner.
   - Click "Send noop action" → revision increments and a log entry appears.
