# `docs/tasks/0001-monorepo-scaffold.md`

## Title

Monorepo scaffold with client/server/core, strict TS, lint/format, and changelog discipline

## Goal

Create the initial pnpm workspace scaffold for a server-authoritative game with a React client. The repository must be ready for iterative development with strict TypeScript, consistent formatting, and a changelog update on every step.

## Scope

* Create pnpm workspace + base config files
* Create empty app packages (`apps/client`, `apps/server`)
* Create core engine package (`packages/core`)
* Establish consistent TypeScript, linting, formatting rules across workspace
* Add initial `CHANGELOG.md` and ensure it is updated in this task
* Provide minimal “smoke” scripts so `pnpm -r build/test` run successfully

## Non-negotiables

* **English-only identifiers** in all source code and config (no German names anywhere in code).
* **Comments are required** where logic exists (scaffolding won’t have much logic yet; still add brief comments in entrypoints explaining intent).
* **Update `CHANGELOG.md`** in this task.
* Keep dependencies minimal and conventional.
* Do not implement game rules yet.

## Deliverables

### A) Workspace files (repo root)

Create or update:

* `pnpm-workspace.yaml`

  * Must include: `apps/*`, `packages/*`
* `package.json` (root)

  * Must define workspace scripts:

    * `dev` runs client + server dev concurrently (prefer `concurrently`)
    * `build` runs `pnpm -r build`
    * `test` runs `pnpm -r test`
    * `lint` runs `pnpm -r lint`
    * `format` runs prettier (repo-wide)
  * Must set `"packageManager": "pnpm@<current>"` (use the local environment default; do not guess exotic versions)
* `tsconfig.base.json`

  * Strict TS settings intended for shared use
* `CHANGELOG.md`

  * Must include an entry for this task (see template below)
* `.editorconfig` (basic)
* `.gitignore` (Node/TS/Vite typical)
* `.prettierrc` (or prettier config in package.json) and `.prettierignore`
* ESLint config (one of the following acceptable patterns):

  * Root `eslint.config.js` (flat config) for monorepo
  * or root `.eslintrc.cjs` + per-package configs
  * Must support TypeScript + React in client package

### B) Packages

Create these folders with package manifests and minimal entrypoints:

#### `packages/core`

* `packages/core/package.json`

  * Name: `@bc/core` (or similarly short; keep consistent with monorepo scope)
  * Build output: `dist`
  * Scripts: `build`, `test`, `lint`
  * TS config extends root base
* `packages/core/src/index.ts`

  * Export a placeholder type or function that demonstrates compilation
  * Add a short comment describing core’s role (deterministic engine, no UI/server dependencies)

#### `apps/server`

* `apps/server/package.json`

  * Name: `@bc/server`
  * Scripts: `dev`, `build`, `test`, `lint`
  * Dependencies: choose one minimal stack:

    * `express` + `ws` OR `fastify` + `ws`
  * Must depend on `@bc/core` via workspace protocol
* `apps/server/src/main.ts`

  * Minimal HTTP server with one route:

    * `GET /health` returns `{ ok: true }`
  * Minimal WebSocket endpoint is OPTIONAL in this task; if included, keep it trivial.
  * Add comments explaining server authority concept (no rules yet).

#### `apps/client`

* `apps/client/package.json`

  * Name: `@bc/client`
  * Scripts: `dev`, `build`, `test`, `lint`
  * Vite + React + TS
  * Must be able to start and render a basic page
* `apps/client/src/main.tsx` + minimal App component

  * Show a heading like “BALANCE // CONTROL”
  * Optional: show server health status by fetching `/health` via dev proxy

### C) Dev proxy

* Configure Vite dev server to proxy `/api` or `/health` calls to server during `pnpm dev`.
* Keep paths consistent (e.g., server listens on `3001`, client on `5173`).

### D) Scripts must work

After implementation, the following must succeed:

* `pnpm install`
* `pnpm dev` (starts client + server)
* `pnpm -r build`
* `pnpm -r test` (can be placeholder tests, but must pass)
* `pnpm -r lint`

## Constraints / Quality bar

* Prefer pnpm workspace linking (`"@bc/core": "workspace:*"`).
* Avoid heavy frameworks. This is scaffolding, not a product.
* No dead config. If you add tooling, it must be wired into scripts.

## Suggested dependency choices (use these unless there’s a strong reason not to)

* Tooling:

  * `typescript`
  * `eslint` + `@typescript-eslint/*`
  * `prettier`
  * `concurrently`
* Client:

  * `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
* Server:

  * `express` (or fastify), `ws` (optional)
* Tests:

  * `vitest` (client/core) and/or `node:test` (server). Choose the simplest unified approach.

## CHANGELOG entry template

Add this entry at top under an “Unreleased” section or dated section:

### 2026-02-09

* **Added:** pnpm monorepo scaffold with `@bc/client`, `@bc/server`, and `@bc/core`
* **Added:** strict TypeScript base config, linting, formatting, and workspace scripts
* **Added:** server health endpoint and basic client shell
* **Notes:** established repo conventions (English-only identifiers, comments, changelog updates)

## Output requirements

At the end of the task, provide:

1. A short summary of what was created
2. List of files touched/created
3. Exact commands to run locally to verify (`pnpm dev`, `pnpm -r build`, etc.)

## Do not do (explicit)

* Do not implement game rules, tiles, board logic, expansions, or UI beyond a shell.
* Do not introduce German identifiers anywhere.
* Do not skip changelog updates.
* Do not add “clever” architectural abstractions yet.