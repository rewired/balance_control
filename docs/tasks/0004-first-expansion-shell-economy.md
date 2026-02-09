# `docs/tasks/0004-first-expansion-shell-economy.md`

## Title

First real expansion package: Economy shell (state slice + one safe action + optional UI panel)

## Goal

Create the first standalone expansion as its own workspace package (npm-installable in principle), wired into:

* `@bc/core` expansion registry
* `@bc/server` static expansion catalog
* `@bc/client` debug UI (and optional expansion panel system)

This expansion must **not** alter gameplay outcomes yet. It is a structural, end-to-end proof:

1. installable package
2. server can enable it at session creation
3. state initializer runs
4. expansion action can be dispatched and is validated/routed
5. snapshot includes the extension state

## Non-negotiables

* **English-only identifiers** in code, types, filenames, folders, exports.
* **Comments are mandatory** where architecture decisions are implemented.
* **Update `CHANGELOG.md`**.
* No real economy rules. No balancing. No “smart” mechanics.
* Expansion must not be able to mutate core state directly (respect the narrow surface from Task 0003).

---

## Deliverables

### A) New workspace package: `packages/exp-economy`

Create a new package:

* Folder: `packages/exp-economy`
* Package name: `@bc/exp-economy`
* TypeScript build to `dist`
* Scripts: `build`, `test`, `lint`
* Dependencies:

  * `@bc/core` via `workspace:*`
  * runtime validation (Zod) if your core pattern expects schemas locally (recommended)

#### Required exports

Export a single expansion module instance, e.g.:

* `economyExpansion` (exact name is flexible; keep consistent and explicit)
* It must satisfy the `ExpansionModule` interface introduced in Task 0003.

Add a short README inside the package (optional but nice):

* what it is
* what it currently does (almost nothing)
* action types it registers

---

### B) Economy expansion content (minimal, structural)

#### 1) Expansion id

* `id` must be `"economy"`
* version can start at `"0.0.1"`

#### 2) State initializer

Register a state initializer that creates a stable slice at:

* `state.extensions["economy"]`

The slice must be a small object with a schema, for example:

* `credits: number` (start at `0`)
* `lastActionAt: number | null`
* `audit: Array<{ id: string; at: number; note: string }>` (start empty; capped if you want)

Rules:

* Keep it boring and deterministic.
* Add comments: this is scaffolding only.

#### 3) Action schema

Register exactly **one** expansion action type:

* `exp.economy.grantCredit`

Payload schema example (choose one and stick to it):

* `{ amount: number; reason?: string }`

Validation:

* amount must be an integer
* must be within a safe range (e.g. 1..3) to prevent spam/log overflow
* reject negative/zero

#### 4) Reducer/handler

Implement the handler so that it:

* updates **only** `state.extensions["economy"]`
* increments `credits` by `amount`
* writes a small audit entry (or emits an event) containing `reason` (if provided)
* does **not** modify any other core fields

**No other effects.** No scoring. No board interaction.

#### 5) Hook usage (optional)

If you use hooks, keep them passive:

* Example: onSnapshot hook can attach a computed field (but prefer not to in this task)
* Do not add complex lifecycle logic

---

### C) Core compatibility and tests

In `packages/core` add/extend tests to prove:

1. When `enabledExpansions: ["economy"]`, the session snapshot contains `state.extensions.economy` with initialized defaults.
2. Dispatching `exp.economy.grantCredit`:

   * succeeds only when economy is enabled
   * changes only extension state
   * produces deterministic results (same inputs → same state)
3. Dispatching it when economy is disabled returns `EXPANSION_NOT_ENABLED`.

Keep tests small but meaningful.

---

### D) Server: add economy to the static expansion catalog

In `apps/server`:

* Add `@bc/exp-economy` as a dependency (`workspace:*`)
* Import it into the static expansion catalog used in Task 0003
* Ensure POST `/api/session` with:

  * `{ "enabledExpansions": ["economy"] }` works

Add/extend server tests:

* enabling `"economy"` succeeds
* enabling unknown still fails as before
* dependency logic still works

---

### E) Client: allow dispatching the economy action (debug UI)

In `apps/client`:

* If `economy` is enabled (from snapshot):

  * show a tiny debug panel section:

    * current `credits`
    * a button “Grant 1 credit” that dispatches `exp.economy.grantCredit` with `{ amount: 1, reason: "debug" }`
* Show any new audit/log info if you added it.

Validation:

* Client must validate the outbound payload shape (Zod recommended, matching core expectations).

**No fancy UI.** This is a wiring proof, not UX.

---

### F) Optional (if you want to lay groundwork, but keep it minimal): expansion UI panel registry

Only do this if it stays very small:

* A client-side map like `expansionPanels: Record<string, React.ComponentType>`
* Render it only for enabled expansions
* Economy can contribute a minimal panel component

If this balloons, skip it. The acceptance criteria do not require it.

---

### G) Changelog update (MANDATORY)

Update root `CHANGELOG.md` with a new dated entry (same date is okay if you keep one section per day; otherwise use actual date):

Include:

* Added first expansion package `@bc/exp-economy`
* Added economy extension state slice initialization
* Added one expansion action `exp.economy.grantCredit` (debug/scaffolding)
* Notes: “No gameplay impact; proof of expansion pipeline”

Do not rewrite previous entries.

---

## Acceptance criteria

* `pnpm dev` works.
* Create session with economy enabled:

  * client shows enabled expansions includes `economy`
  * snapshot includes `state.extensions.economy`
* Dispatch `exp.economy.grantCredit`:

  * revision increments
  * credits increases by 1
  * no other state changes
* Dispatching economy action while economy is not enabled fails with `EXPANSION_NOT_ENABLED`.
* `pnpm -r build`, `pnpm -r test`, `pnpm -r lint` all pass.
* No German identifiers introduced.
* Comments exist in the expansion package explaining constraints.

---

## Explicitly do NOT do

* Do not implement real economy measures, tiles, scoring, conversions, upkeep, or costs.
* Do not add new core gameplay actions.
* Do not add more than one economy action in this task.
* Do not introduce runtime plugin loading.

---

## Output requirements (Codex must report)

1. Summary of what was added
2. List of files touched/created
3. Manual verification steps (exact clicks in client)
4. Exact commands to run

---
