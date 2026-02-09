# AGENTS.md — BALANCE // CONTROL (Hotseat → Multiplayer-ready)

This repository is a pnpm monorepo. It contains a server-authoritative game engine and a React client.
You are an engineering agent. Your job is to implement tasks exactly as described, without inventing rules or features.

## Non-negotiable rules

### 1) English-only identifiers (MANDATORY)
- **No German names** in source code: no method, class, variable, file, folder, type, enum, constant, interface names in German.
- Domain terms must be **English canonical** (e.g., "influence", "hotspot", "committee", "lobbyist", "overlay", "measure", "resource", "tile", "board", "turn").
- If you encounter German names in existing files, **rename them** to English and update references.

### 2) Comments are crucial (MANDATORY)
- Add comments for:
  - non-obvious logic
  - rule enforcement and edge cases
  - plugin/expansion hooks and invariants
  - serialization/replay assumptions
- Prefer **short, high-signal comments** over noise.
- Use JSDoc/TSDoc for public APIs in `packages/*`.

### 3) Changelog discipline (MANDATORY)
- Keep a `CHANGELOG.md` at repository root.
- **Every change set** (each task/PR) must update the changelog:
  - date (YYYY-MM-DD)
  - scope (core/server/client/expansion)
  - what changed (user-visible + developer-visible)
  - migration notes if any
- If a task touches rules/logic, include a brief “Rule impact” note.

### 4) Do not invent game rules
- Implement only what is explicitly specified by tasks and existing design documents.
- If something is unclear, implement the **minimal safe behavior** and add a TODO comment plus a short note in the changelog.

### 5) Determinism and authority
- The server is the **single source of truth**.
- Client is a renderer + input device.
- Core engine must be deterministic. If randomness is required, use a seeded RNG owned by server/core.

### 6)Temporary file hygiene (MANDATORY)

- Any temporary, intermediate, or helper files created during code generation
  (e.g. scratch files, throwaway scripts, debug outputs, migration helpers,
  one-off transforms, copied experiments, or staging artifacts)
  **must be removed before task completion**.

- The final codebase must not contain:
  - unused files
  - orphaned scripts
  - temporary generators
  - debug-only helpers
  - abandoned refactors
  - commented-out experiments used only during development

- If a temporary file was necessary to implement the task:
  - it must either be **deleted**, or
  - explicitly justified and documented if it is kept (rare case).

- Leaving temporary files behind is considered a **task failure**.
  The repository must be left in a **clean, intentional, production-ready state**.

## Repository structure (target)

- `apps/client` — React + Vite UI
- `apps/server` — Node server (authoritative), API + websocket
- `packages/core` — game engine (state, actions, reducers/effects, validations)
- `packages/exp-*` — expansions as plugins (optional at start; architecture must support it)

## Expansion/plugin architecture requirements

- Core must provide:
  - a `GameState` with an `extensions` namespace: `state.extensions[expansionId]`
  - an `Action` envelope that allows expansion actions without changing core every time
  - hook points (lifecycle + validation + resolution)
  - a registry for expansion modules
- Expansions must be installable as separate packages.
- The goal is that enabling an expansion should NOT require editing unrelated game logic.

## Technology constraints

- Use TypeScript everywhere.
- Monorepo uses `pnpm` workspaces.
- Prefer battle-tested npm packages when appropriate.
- Keep dependencies minimal in `packages/core` (avoid UI or server dependencies).

## Coding standards

- Use strict TypeScript settings.
- Prefer pure functions in core logic.
- Avoid implicit global state.
- Provide robust runtime validation for network-bound payloads (schemas).
- Ensure consistent formatting/linting.

## Testing and verification

- Core must have unit tests for:
  - action validation
  - state transitions (reducer/effect behavior)
  - key invariants (e.g., no illegal placements, no negative resources, etc.)
- Introduce snapshot/replay tests as soon as a minimal action loop exists.

## Commit/PR hygiene (task-based workflow)

For each task:
1. Read the task file in `docs/tasks/`.
2. Implement exactly what is required.
3. Update `CHANGELOG.md`.
4. Add/adjust tests.
5. Ensure `pnpm -r test` and `pnpm -r build` succeed.
6. Provide a short summary of changes and list touched files.

## Language and writing
- Code, comments, docs: English.
- Player-facing text in UI: English by default unless task specifies otherwise.
- Keep naming consistent and explicit.

## What to do first (bootstrap priorities)
1. Create workspace scaffolding (client/server/core packages).
2. Implement a minimal "hello session" flow:
   - server creates a session
   - client connects and receives a snapshot
3. Establish the action protocol and deterministic core loop.
4. Only then start adding real rules and expansions.
