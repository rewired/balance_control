# `docs/tasks/0002-action-protocol-and-session-snapshot.md`

## Title

Action protocol + session snapshots over WebSocket (server-authoritative, expansion-ready)

## Goal

Introduce the minimal networking and engine plumbing to support:

* creating a game session on the server
* connecting from the client via WebSocket
* receiving a full **snapshot** of the session state
* dispatching **actions** from client → server
* server validates, applies, and broadcasts updated snapshots + events

This task must **not** implement actual game rules yet. It establishes the contract and the “authoritative loop” only.

## Context / Current repo assumptions

* pnpm workspace + scripts exist already 
* server has `/health`
* client is Vite React and proxies `/health` in dev 
* changelog discipline exists and must be updated again in this task 

## Non-negotiables

* **English-only identifiers** everywhere (code, types, file names, events).
* **Comments are crucial**: add brief, high-signal comments around protocol decisions and invariants.
* **Update `CHANGELOG.md`** in this task.
* Server remains the **single source of truth**.
* Core logic must be deterministic and pure where possible.
* Do not invent or codify board rules; keep state minimal and generic.

## Recommended transport

Use **Socket.IO** for the WebSocket layer because it has first-class TypeScript event typing support. ([socket.io][1])
(If you strongly prefer `ws`, you may use it, but then you must still provide strong runtime validation and typed event envelopes.)

## Deliverables

### A) Core package: protocol primitives

In `packages/core`, add a small protocol module (names are suggestions; keep consistent):

* `ActionEnvelope`:

  * `sessionId: string`
  * `actionId: string` (unique; nanoid/uuid)
  * `type: string` (namespaced; e.g. `core.passTurn`, `core.placeTile` later, `exp.wirtschaft.someAction` later)
  * `payload: unknown`
  * `actorId: string` (for hotseat: current player id; for now can be `"hotseat"`)
  * `clientTime?: number` (optional)
  * `meta?: Record<string, unknown>` (optional)
* `ServerError`:

  * machine-readable `code` (e.g. `VALIDATION_ERROR`, `UNKNOWN_ACTION`, `SESSION_NOT_FOUND`, `NOT_AUTHORIZED`)
  * human `message`
  * optional `details`
* `GameSnapshot` (MVP):

  * `sessionId`
  * `revision: number` (increments on every accepted action)
  * `createdAt`
  * `updatedAt`
  * `config` (at least: `mode: "hotseat"`, and `enabledExpansions: string[]`)
  * `state` (minimal placeholder; must include `extensions: Record<string, unknown>` to keep expansion-ready)
  * `log: Array<{ id: string; at: number; kind: string; message: string }>` (very small event log, optional but helpful)

**Validation**

* Use runtime validation (Zod is recommended) for:

  * inbound client events + action envelopes
  * server-to-client messages
* Keep Zod schemas next to the types (or derived via `z.infer`).

### B) Core package: minimal engine loop (no game rules)

Add in `packages/core`:

* `createInitialState(config) => state`
* `applyAction(state, actionEnvelope) => { nextState, events }`

  * MVP behavior:

    * accept only **one** trivial action type: `core.noop` (or `core.ping`)
    * unknown action types must return a structured error
    * increment `revision` on accepted actions
    * append an event log entry on accepted actions
* Comment clearly: “Rules not implemented yet; this is scaffolding.”

### C) Server package: sessions + socket wiring

In `apps/server`:

* Add a `SessionStore` in memory:

  * `Map<sessionId, Session>`
  * `Session` contains snapshot/state, config, revision, created/updated timestamps
* Add an HTTP endpoint:

  * `POST /api/session`

    * creates a session
    * returns `{ sessionId }`
    * accepts optional body: `{ enabledExpansions?: string[] }` (validate)
* Add Socket.IO:

  * server emits and receives typed events (define interfaces)
  * required server events:

    * `server:hello` (sent on connect; includes server version + capabilities)
    * `server:snapshot` (full snapshot)
    * `server:event` (log/event entries, optional)
    * `server:error` (structured error)
  * required client events:

    * `client:join` (payload: `{ sessionId }`)
    * `client:dispatch` (payload: `ActionEnvelope`)
* Server flow:

  1. Client connects → server sends `server:hello`
  2. Client calls `client:join` → server validates and responds with `server:snapshot`
  3. Client sends `client:dispatch` → server validates action envelope, applies via `@bc/core`, updates session snapshot, broadcasts `server:snapshot` to all sockets in that session “room”
  4. On failure, server emits `server:error` to that socket only

**Hotseat note**

* No authentication yet. But design the protocol so that adding auth later doesn’t break it (i.e., keep `actorId`, keep `sessionId`, keep errors).

### D) Client package: connect, create session, join, dispatch

In `apps/client`:

* Add socket client connection
* Provide minimal UI controls:

  * “Create session” button → calls `POST /api/session`, stores returned sessionId
  * “Join session” auto-joins after create (or a separate button)
  * Show:

    * connection status
    * current `sessionId`
    * current `revision`
    * enabled expansions list
  * “Send noop action” button → dispatch `core.noop` to server
  * Show last N log entries (event log)

**Validation on client**

* Even though server is authoritative, client should validate outbound payload shape (Zod) to avoid garbage.

### E) Expansion readiness (MVP contract)

Without implementing expansions, ensure the scaffolding supports them:

* `enabledExpansions` exists in config and is sent in snapshot
* `state.extensions` exists and is stable
* Action `type` supports namespacing (`exp.<id>.<name>`) even if not used yet
* Add comments explaining where expansion modules will be registered later

### F) Tests

Add tests (minimal, but real):

* `packages/core`:

  * `applyAction` accepts `core.noop` and increments revision
  * rejects unknown action type with structured error
* `apps/server` (choose simplest approach):

  * session creation returns id
  * optional: socket join + snapshot roundtrip (can be an integration test if easy; otherwise document a manual test procedure in README)

### G) Changelog update (MANDATORY)

Update root `CHANGELOG.md` with a new dated entry (2026-02-09 is fine if you keep same day, otherwise use today’s date) including:

* Added action protocol + snapshot messaging
* Added session creation endpoint
* Added socket wiring (server/client)
* Notes on expansion readiness and “rules not implemented yet”

(Keep the existing entries intact.) 

## Acceptance criteria

* `pnpm deer 
* From the client UI you can:

  * join it via socket
  * receive a snapshot
  * dispatch `core.noop`
  * see `revision` increment and log entry update
* `pnpm -r build`, `pnpm -r test`, `pnpm -r lint` all pass 
* No German identifiers introduced exist around protocol decisions and invariants.
* `CHANGELOG.md` updated.

## Implementation notes / guardrails

* Keep `packages/core` free of server/client dependencies.
* Prefer `workspace:*` for internal deps.
* Don’t over-engineer: one session store, one socket namespace, one action type.
* Any “future” decisions must be written as comments and/or changelog notes, not as unused abstractions.

## Output requirements (what Codex must report back)

At the end, provide:

1. Short summary
2. List of files touched
3. Manual verification steps (“click X, observe Y”)
4. Exact commands to run

---
