# `docs/tasks/0003-expansion-registry-and-schema-driven-routing.md`

## Title

Expansion module registry and schema-driven action routing (disabled by default)

## Goal

Introduce a **formal expansion/plugin system** into the core engine and server without enabling any real expansion yet.

After this task:

* The core engine can **register expansion modules**
* Actions are **routed and validated via schemas**
* Unknown expansion actions are rejected cleanly
* The base game still behaves exactly as before (only `core.*` actions work)

This task is about **architecture**, not gameplay.

## Non-negotiables

* **English-only identifiers** everywhere.
* **Comments are mandatory** around:

  * expansion boundaries
  * invariants (what core guarantees, what expansions may not do)
  * why routing is schema-driven
* **Update `CHANGELOG.md`**.
* Do not implement any real expansion logic.
* No rule changes.

---

## Conceptual model (must be followed)

### Core principles

* Core **does not know** concrete expansion rules.
* Expansions are **modules**, not flags.
* Expansions:

  * register schemas
  * register hooks
  * optionally own a namespaced state slice
* Core remains authoritative and deterministic.

---

## Deliverables

### A) Core: Expansion module interface

In `packages/core`, define a **single, explicit interface** for expansions.

Conceptually, an expansion module must be able to provide:

* `id: string`

  * stable, lowercase, ascii (e.g. `"economy"`, `"security"`, `"climate"`)

* `version: string`

* `requires?: string[]` (other expansion ids, optional)

* `register(registry)`
  Called once at engine startup.

The registry object exposed to expansions must allow:

* `registerAction(schema)`
* `registerReducer(handler)`
* `registerHook(hookName, handler)`
* `registerStateInitializer(initializer)`
* `registerEventMapper(mapper)` (optional, for UI/logging later)

⚠️ The registry **must not** expose raw engine internals.
Expansions interact only through explicit APIs.

Add comments explaining:

* why this is intentionally restrictive
* what expansions are *not allowed* to do

---

### B) Core: Action schema registry

Extend the action system from Task 0002:

* Maintain a central **ActionSchemaRegistry**

  * keyed by full action type string (e.g. `core.noop`, `exp.economy.invest`)
* Each schema defines:

  * `type`
  * `payload` schema
  * optional metadata (e.g. `requiresExpansionId`)

Rules:

* If an action type is not registered → reject with structured error
* If action requires an expansion that is not enabled → reject
* Core actions (`core.*`) are always allowed

This registry must be:

* created once at engine startup
* immutable at runtime (no hot-plugging mid-session)

---

### C) Core: Expansion lifecycle hooks

Define and wire the following **hook points** (even if unused yet):

* `onEngineInit`
* `onSessionCreate`
* `onBeforeActionValidate`
* `onValidateAction`
* `onApplyAction`
* `onAfterAction`
* `onSnapshot`

Rules:

* Hooks are executed in **deterministic order**:

  1. core
  2. expansions (sorted by expansion id)
* Hooks may:

  * read state
  * return validation errors
  * return state patches/events
* Hooks may **not**:

  * mutate state directly
  * bypass action validation

Add comments describing hook ordering guarantees.

---

### D) Core: Expansion state namespace

Formalize expansion state handling:

* `GameState` already contains:

  ```ts
  extensions: Record<string, unknown>
  ```

Extend this so that:

* On session creation:

  * for each enabled expansion
  * if it registered a state initializer
  * its slice is created at `state.extensions[expansionId]`
* Core never reads or writes expansion state directly.

Add runtime checks:

* prevent two expansions from using the same id
* prevent core actions from accidentally touching extension state

---

### E) Server: Expansion loading (static)

In `apps/server`:

* Add an **expansion loader**:

  * imports expansion modules (hardcoded list for now)
  * registers them with core engine on startup
* Session creation must:

  * accept `enabledExpansions: string[]`
  * validate requested expansions exist and dependencies are satisfied
  * store enabled expansion ids in session config

Important:

* Do **not** implement dynamic runtime loading yet.
* Expansions are compiled-in npm dependencies for now.
* Keep this simple and explicit.

---

### F) Server: Error semantics

Extend structured errors to cover expansion cases:

* `EXPANSION_NOT_ENABLED`
* `EXPANSION_NOT_FOUND`
* `EXPANSION_DEPENDENCY_MISSING`
* `ACTION_SCHEMA_NOT_REGISTERED`

Ensure:

* errors are machine-readable
* client receives clear messages
* comments explain which errors are safe to show to players later

---

### G) Client: Capability awareness (no UI yet)

In `apps/client`:

* When receiving `server:hello` or `server:snapshot`:

  * store list of enabled expansions
* Display enabled expansion ids somewhere small (debug panel is enough)
* Do **not** add expansion-specific UI yet.

---

### H) Tests

Add tests in `packages/core`:

* registering two expansions with same id → fails
* action with unregistered type → rejected
* action requiring disabled expansion → rejected
* expansion state initializer is called on session creation

Server tests (minimal):

* session creation rejects unknown expansion id
* session creation rejects missing dependency

---

### I) Changelog update (MANDATORY)

Append a new dated entry to `CHANGELOG.md`:

Include:

* Added expansion module registry
* Added schema-driven action routing
* Added expansion lifecycle hooks (inactive)
* Notes: “No gameplay impact; architecture only”

Do not remove or rewrite previous entries.

---

## Acceptance criteria

* All previous Task 0002 behavior still works.
* `core.noop` still dispatches successfully.
* Adding a fake expansion module (even empty) does not break anything.
* Unknown or disabled expansion actions fail cleanly.
* `pnpm dev`, `pnpm -r build`, `pnpm -r test`, `pnpm -r lint` all pass.

---

## Explicitly do NOT do

* Do not implement economy/security/climate logic.
* Do not add real expansion packages yet.
* Do not add UI beyond debug display.
* Do not introduce runtime plugin loading from disk/network.
* Do not weaken validation “just for now”.

---

## Output requirements (Codex must report)

1. Summary of architectural changes
2. Files touched
3. Verification steps
4. Exact commands to run

---
