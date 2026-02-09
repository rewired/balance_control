# `docs/tasks/0009-resources-production-and-resolution-extensible.md`

## Title

Extensible resource system: resource registry, player pools, tile production, and end-of-turn resolution

## Goal

Implement the minimal “resource economy loop” for the base game in a way that is **open for expansions**:

* Core defines a **resource registry** (default resources) but does **not** hardcode resource fields.
* Players have **resource pools** keyed by resource id.
* Placed tiles produce resources for their owning player.
* At turn end (`core.passTurn`), resources are **resolved** and added to pools.
* Client displays pools and a per-turn resolution breakdown.

No majorities/hotspots/scoring yet. This is purely the production/accounting backbone.

## Non-negotiables

* English-only identifiers.
* Comments mandatory around extensibility and resolution timing.
* Update `CHANGELOG.md`.
* Follow the expansion rules: resources may be added by expansions without changing core game logic.
* Deterministic core behavior.
* Server authoritative.

---

## Core design requirement: resources must be extensible

### Resource IDs

Resource types are identified by stable string ids, e.g.:

* `"domestic"`
* `"foreign"`
* `"media"`

These are the **base set**, but the system must allow later additions like `"economy"` or `"energy"` etc.

### Resource registry

Introduce a registry in core that provides:

* the set of known resource ids for a session
* optional metadata for UI (label/iconKey) but keep minimal

Expansions must be able to contribute resources via the expansion system from Task 0003:

* expansion registers resource definitions at engine init / session create time
* core stores enabled resources in session config/state

Avoid hardcoding resource keys in TypeScript as fixed properties.

---

## Deliverables

### A) Core: Resource definitions and pools

In `packages/core`:

Define:

* `ResourceId = string`
* `ResourceDef { id: ResourceId; label: string; iconKey?: string }` (keep minimal)
* `ResourceRegistry` (session-scoped) containing a list/map of `ResourceDef`

Player pools:

* `resourcesByPlayerId: Record<string, Record<ResourceId, number>>`

  * all missing keys treated as 0
  * initialize all known resource ids to 0 for each player at session create

Add comments:

* why map-based pools are required for expansions
* invariants: never negative unless explicitly allowed later (for now clamp or reject)

### B) Core: Default base resources

Register base resource defs in core:

* domestic / foreign / media

Make these appear in the session registry by default, even if no expansions enabled.

### C) Expansion hook integration (resource contribution)

Add a narrow extension point:

* expansions may register additional `ResourceDef`s via the expansion registry mechanism (Task 0003)

Rules:

* resource ids must be unique across core + expansions
* if duplicate id is registered, fail engine init with a clear error (`DUPLICATE_RESOURCE_ID`)

Note: This task does not require an expansion to add a new resource yet, but the mechanism must exist.

### D) Core: Tile production model (extensible)

Extend `Tile` to include production as a map:

* `production: Record<ResourceId, number>`
  MVP constraint:
* A tile produces exactly **one** resource id with amount 1 (simple baseline).
* Later we can add multi-production tiles.

Update supply generation (from 0007):

* deterministic mix of tile kinds that map to domestic/foreign/media production.
* Ensure tile objects include `production` accordingly.

### E) Core: End-of-turn resource resolution (on `core.passTurn`)

When `core.passTurn` succeeds:

* compute totals for the **player who is passing**

  * sum production for all tiles on board owned by that player
* add totals to their pool in `resourcesByPlayerId`
* emit a structured event:

  * `kind: "resourceResolution"`
  * payload:

    * `playerId`
    * `delta: Record<ResourceId, number>`
    * `tileCount: number`

Important:

* Per-player resolution (not global round).
* Deterministic iteration order when summing:

  * sort tile keys before summing to avoid non-deterministic object iteration differences
  * comment why

### F) Client: debug display

In `apps/client`:

* show the session resource registry (list resource ids + labels)
* show each player’s resource pool as rows
* show last resourceResolution event as a breakdown (delta map)

No icons required; text is enough.

### G) Tests

In `packages/core`:

* session creates pools with all known resource ids set to 0
* placing tiles with production maps results in correct deltas on passTurn
* delta map contains only the resources produced (or includes zeros—pick one approach and document)
* deterministic ordering: same actions produce same delta map keys and values
* duplicate resource id registration fails

Server tests:

* create session and verify snapshot contains resource registry + initialized pools
* draw/place/pass increments resources

### H) Changelog update (MANDATORY)

Append entry:

* Added extensible resource registry and map-based player pools
* Added tile production using resource id maps
* Added end-of-turn resource resolution event
* Notes: “Designed for expansions to add new resources without core changes”

---

## Acceptance criteria

* `pnpm dev` works
* Resources are visible as a list (registry) and per-player pools
* On passTurn, passing player’s resources increase deterministically
* All builds/tests/lint pass
* No German identifiers
* Comments document extensibility and determinism
* System can accept a new resource id from an expansion (even if no real expansion uses it yet)

---

## Explicitly do NOT do

* No majorities/hotspots/scoring
* No influence markers
* No real expansion gameplay logic
* No UI polish beyond debug

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---

