# Changelog

### 2026-02-09

* **Added:** pnpm monorepo scaffold with `@bc/client`, `@bc/server`, and `@bc/core`
* **Added:** strict TypeScript base config, linting, formatting, and workspace scripts
* **Added:** server health endpoint and basic client shell
* **Notes:** established repo conventions (English-only identifiers, comments, changelog updates)
---

Additional notes on 2026-02-09:

* Enabled Vite production build by approving `esbuild` via `onlyBuiltDependencies` in `pnpm-workspace.yaml`.
* Switched `@bc/client` `build` script back to `vite build` and validated output.
* Added `README.md` with installation and run instructions.
* Added root `preview` script delegating to `@bc/client preview`.
* Added `preview:full` script: builds client and serves it from the server (`SERVE_STATIC=1`).
* Server now optionally serves static client build from `apps/client/dist` when `SERVE_STATIC=1`.
* README updated with preview instructions.

* Added root `ci:smoke` script (install → rebuild esbuild → -r build/test/lint).


### 2026-02-09 (continued)
* Added action protocol primitives with Zod validation in `@bc/core`.
* Added minimal engine loop with `core.noop` and snapshot/log updates.
* Added in-memory session store and `POST /api/session` endpoint.
* Added Socket.IO wiring: server hello, snapshot broadcast, error handling.
* Updated client to create/join session and dispatch `core.noop`.
* Notes: server remains authoritative; no game rules implemented; state is expansion-ready.
### 2026-02-09 (turn system)
* Added player and turn system to core (`players`, `activePlayerIndex`, `turn`).
* Added first base-game action `core.passTurn` with validation (only active player may act) and deterministic turn advance.
* Server: extended `POST /api/session` to accept `players` (min 2, max 6); defaults to 2 placeholders when omitted; enforces `actorId` membership (`ACTOR_NOT_ALLOWED`).
* Client: debug UI now shows players, highlights active player, displays turn number, and provides a “Pass turn” button.
* Notes: Foundation for all future gameplay actions. Turn logic lives in core; server remains the authority and must not override it.
