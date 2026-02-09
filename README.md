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

## Turn Flow (Rules v1.0.9 — 7.1/7.2)
The core engine enforces a strict turn pipeline with no tile hands.

- Phase order: `awaitingPlacement` → `awaitingAction` → `awaitingPass`.
- Draw (7.1):
  - Dispatch `core.drawTile` at the start of your turn (only in `awaitingPlacement`).
  - Engine scans the supply from the current `drawIndex`:
    - If the top tile is globally unplaceable, it is moved openly to `state.supply.openDiscard` and the next tile is checked immediately.
    - First placeable tile is stored in `state.pendingPlacementTile` and `drawIndex` advances.
    - If no placeable tile is found (supply exhausted), the engine sets `pendingPlacementTile = null` and moves to `awaitingAction` (7.1 entfällt).
- Place (7.1):
  - Dispatch `core.placeTile` with `{ coord }` to place the current `pendingPlacementTile`.
  - No tile id is required/accepted; politics tiles never enter a hand.
  - Placement legality: first tile may be anywhere; otherwise the coord must be adjacent to an existing tile (default behavior; expansions may further restrict via hooks).
  - On success, `pendingPlacementTile` is cleared and phase → `awaitingAction`.
- Action (7.2):
  - Perform exactly one political action (e.g., `core.placeInfluence` or `core.moveInfluence`). On success, phase → `awaitingPass`.
- Pass:
  - Dispatch `core.passTurn` to end the turn. Turn increments, active player advances. On wrap to round start, per‑round measure flags are reset; expiring effects are pruned deterministically.

Client integration notes:
- Allowed actions by phase:
  - `awaitingPlacement`: `core.drawTile` (once, loops internally) and then `core.placeTile`.
  - `awaitingAction`: one of the political actions (e.g., `core.placeInfluence`, `core.moveInfluence`).
  - `awaitingPass`: only `core.passTurn`.
- State shape (relevant fields):
  - `state.supply = { tiles, drawIndex, openDiscard }`
  - `state.pendingPlacementTile: Tile | null`
  - No `hands` for politics tiles. (Measure cards remain separate and unaffected.)
- Error codes to expect: `ACTION_NOT_ALLOWED_IN_PHASE`, `CELL_OCCUPIED`, `DUPLICATE_TILE_ID`, `HOOK_REJECTED`.

Example turn (happy path):
1) `core.drawTile` → engine sets `pendingPlacementTile`.
2) `core.placeTile` with `{ coord: { q, r } }` → tile placed, phase → `awaitingAction`.
3) `core.placeInfluence` (or `core.moveInfluence`) → phase → `awaitingPass`.
4) `core.passTurn` → next player, phase → `awaitingPlacement`.
