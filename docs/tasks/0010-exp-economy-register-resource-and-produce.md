# `docs/tasks/0010-exp-economy-register-resource-and-produce.md`

## Title

Economy expansion registers a new resource and participates in base resource resolution (no core changes)

## Goal

Prove the extensible resource system end-to-end:

* `@bc/exp-economy` registers a new resource id: **`"economy"`**
* The session resource registry includes it when the expansion is enabled
* Player pools include `"economy": 0` at session creation
* We can produce economy resources through tiles and resolve them on `core.passTurn`

Critical requirement: **No “special-case economy” code in core.**
Core must treat economy like any other resource id.

## Non-negotiables

* English-only identifiers.
* Comments mandatory around why this proves extensibility.
* Update `CHANGELOG.md`.
* No gameplay balancing. This is scaffolding proof.
* Keep economy expansion narrow (register defs + minimal helper).

---

## Deliverables

### A) Economy expansion: register the resource definition

In `packages/exp-economy`:

Register a `ResourceDef` through the registry extension point added in Task 0009:

* `id: "economy"`
* `label: "Economy"`
* optional `iconKey: "factory"` (or whatever your UI token system uses; keep optional)

Rules:

* Must be registered only when the expansion is enabled.
* Must fail cleanly if duplicate id already exists.

Add a short comment: resource registration is session-scoped and deterministic.

---

### B) Economy expansion: (minimal) helper for economy tile production

We need a way to generate at least one tile that produces `"economy"`.

You have two acceptable approaches; pick ONE and keep it minimal:

#### Option 1 (preferred, no core changes): Expansion provides a supply “patch hook”

If your core has a hook that can modify initial supply generation or post-process it (added earlier as hooks scaffolding):

* Economy expansion uses `onSessionCreate` (or equivalent) to append N economy tiles to the supply.
* These tiles must have:

  * `kind: "economy-1"` (or similar English)
  * `production: { "economy": 1 }`
* Keep N small (e.g., 5).
* Ensure deterministic ordering:

  * append at the end, or insert at a fixed position
  * comment why

#### Option 2 (acceptable): Server session creation parameter includes extraSupply

If you do not have a safe supply hook, implement a minimal session-create override path:

* POST `/api/session` accepts `extraSupplyTiles?: Tile[]` (validated)
* Economy expansion exports a helper `createEconomyTiles(n, seed?)` used by server expansion loader
* Server adds these tiles when economy is enabled

This is slightly less elegant, but still respects “no core special-casing”.

**Do NOT** hardcode economy into core supply generator.

---

### C) Core: no economy-specific logic

Core changes should be limited to:

* If you need a generic hook invocation point that already exists, use it.
* If a missing generic hook prevents Option 1 entirely, you may add a **generic** hook call (e.g., `onSupplyGenerate` or `onSessionCreate` supply mutator), but:

  * It must be expansion-agnostic.
  * It must be documented as a generic extension mechanism.
  * It must not mention economy by name.

If core already supports the needed hooks, do not touch core.

---

### D) Server: enable economy adds resource + economy tiles

In `apps/server`:

* When `enabledExpansions` includes `"economy"`:

  * economy resource is registered via expansion module (automatic through engine init / registry)
  * supply includes some economy-producing tiles (via Option 1 or 2)
* Ensure session snapshot shows:

  * resource registry includes `"economy"`
  * player pools include `"economy": 0`

Add/extend server tests verifying:

* enabling economy produces registry+pool entries
* supply includes at least one tile whose production has `"economy"`

---

### E) Client: display and verify economy production

In `apps/client`:

* registry display should automatically show `"economy"` when enabled
* pool display should show economy column/value
* Provide an easy manual path:

  1. create session with economy enabled
  2. draw tiles until you get an economy-producing tile (or if you append them predictably, the first draws should show them)
  3. place economy tile
  4. pass turn
  5. observe economy pool increased

Optional (nice but minimal):

* Add a debug filter showing tile production map for tiles in hand, so economy tiles are obvious.

---

### F) Tests

Core tests (only if core changed generically):

* ensure generic hook ordering is deterministic
* ensure hook cannot violate invariants (e.g., duplicate tile ids rejected)

Expansion tests (`packages/exp-economy`):

* resource def registered correctly
* generated economy tiles have correct production map and stable ids

Integration tests (server + core):

* with economy enabled:

  * registry contains economy
  * resourcesByPlayerId contains economy keys
  * after placing economy tile and passing: economy increases

---

### G) Changelog update (MANDATORY)

Append entry to root `CHANGELOG.md`:

* Economy expansion registers new resource id `"economy"`
* Economy expansion can add economy-producing tiles to supply (generic mechanism)
* Verified base resource resolution accounts for expansion resources without core special-casing
* Notes: “Proof of extensible resource pipeline”

---

## Acceptance criteria

* Create session with `{ enabledExpansions: ["economy"] }`
* Snapshot shows `"economy"` in resource registry and player pools
* At least one supply tile produces economy
* After placing an economy tile and passing turn, economy pool increments deterministically
* All builds/tests/lint pass
* No German identifiers
* No economy-specific logic in core resource resolution

---

## Explicitly do NOT do

* No real economy measures/cards/rules
* No scoring, majorities, hotspots, influence
* No UI polish beyond debug visibility
* No runtime plugin loading from disk/network

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---
