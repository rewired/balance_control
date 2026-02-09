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

Summary

Core status (as of 0008):

Turn phases enforced: awaitingPlacement → awaitingAction → awaitingPass.
Core actions implemented: core.placeTile (from hand), core.drawTile, core.passTurn with actor/phase validation.
Deterministic seed plumbing present; supply generator exists (ids and kinds).
Board uses axial coords and JSON-stable entries.
Server: actorId enforcement, seed accepted at session create, pass-through to core.
Client: debug UI shows players, active player, phase, board, hand; buttons wired to actions; phase-based enable/disable.
Tests: core (turns, phases, supply, placement) and server (session create, placement phase gating) pass.
Temporary scaffolding cleaned earlier; no leftover temp files to remove for this task.
0009 scope (resources and end-of-turn resolution):

Add an extensible resource registry (base: domestic, foreign, media).
Make Tile carry production map (Record<ResourceId, number>).
Keep determinism: registry composed at engine init; production summed deterministically on passTurn.
Pools are per-player maps keyed by resource id; client shows pools + last resolution delta.
Files Touched

Core protocol/types
packages/core/src/protocol/index.ts
Add ResourceId, ResourceDef schema.
Extend TileSchema with production: Record<string, number> (ints, non-negative).
Add GameState fields:
resources: { registry: ResourceDef[] }
resourcesByPlayerId: Record<string, Record<ResourceId, number>>
Extend ServerError enum with DUPLICATE_RESOURCE_ID.
Add optional payload to EventLogEntry (for resourceResolution).
Core expansion registry
packages/core/src/expansion/types.ts
ExpansionRegistry: add optional registerResourceDef(def: ResourceDef).
EngineRegistries: add resourceDefs: Map<string, ResourceDef>.
packages/core/src/expansion/registry.ts
Initialize resourceDefs.
Implement registerResourceDef with duplicate-id guard.
Core engine
packages/core/src/expansion/engine.ts
Base resources constant (domestic/foreign/media).
On createInitialSnapshot:
Compose registry = base + expansion-contributed (error on duplicate).
Initialize resourcesByPlayerId with zeros for each player/resource.
PassTurn reducer:
Sort board cells by key (deterministic).
Sum production for active player’s placed tiles into totals map.
Add totals to pools[activeId].
Emit event: kind: "resourceResolution", payload: { playerId, delta, tileCount }.
Keep existing pass-turn message; order events [resourceResolution, pass].
Supply
packages/core/src/supply.ts
Include production in generated tiles (map kind to resource):
generic-a → { domestic: 1 }, generic-b → { foreign: 1 }, generic-c → { media: 1 }.
Server (no behavior changes)
apps/server/src/app.ts: none required (schema-wrapped, already passes snapshots/events).
Client debug UI
apps/client/src/App.tsx
Show registry ids.
Render per-player pools row with current amounts.
Show last resourceResolution delta breakdown.
Tests
Core tests
packages/core/src/resources.test.ts
Pools initialized to 0 for all players/resources.
place → draw → pass increases passing player’s pool by correct resource (+1).
Deterministic keys/values implied by seeded supply + sort-by-key when summing.
packages/core/src/resources-dup.test.ts
Engine init or snapshot creation fails when an expansion registers a duplicate resource id.
Server tests
apps/server/src/resources.test.ts
Session create → place → draw → pass results in pool increment for p1; snapshot contains registry + pools.
Docs/Changelog
CHANGELOG.md
New dated entry describing registry/pools, production, passTurn resolution event, extensibility notes.
Manual Verification Steps

Dev run
pnpm dev
Create session (default 2 players).
UI: verify registry shows: domestic, foreign, media; pools rows for p1/p2 with zeros.
Hotseat flow:
p1 place from initial hand at (0,0) → phase = awaitingAction.
p1 draw → phase = awaitingPass.
p1 pass → active player advances; turn increments; resource pools show +1 for the resource produced by the placed tile (based on kind → resource mapping).
Event log shows two items: resourceResolution (with payload) then core.passTurn message. UI displays last resolution delta.
Negative cases (covered by tests, quick smoke if desired)
Duplicate registry id (inject dummy expansion): expect error.
Determinism
Start two sessions with same seed, players → verify registry identical and first placed tile produces same resource.
Exact Commands

Build and test all:
pnpm -r build
pnpm -r test
pnpm -r lint
Dev:
pnpm dev (server + client)
Server-only integration tests:
pnpm --filter @bc/server test
Core-only tests:
pnpm --filter @bc/core test
Implementation Notes and Guardrails

Determinism:
Registry compilation must be stable (sort by id).
When resolving resources, iterate board cells sorted by key to avoid map/object ordering ambiguities.
Extensibility:
Never hardcode resource keys into state types; use map/Record<ResourceId, number>.
Enforce duplicate resource-id failure with a clear error (surface as DUPLICATE_RESOURCE_ID).
Tile production:
MVP restricts to a single resource id with amount 1; model supports arbitrary map.
Client event payload:
EventLogEntry gains payload (unknown); client checks kind === 'resourceResolution' and renders payload safely.
Backward-compatibility:
Server remains pass-through; no extra logic required beyond existing validation.
Keep 0008 invariants intact:
Phase gating unchanged: place only in awaitingPlacement; draw only in awaitingAction; pass only in awaitingPass.
Maintain hand limit (5) and NOT_ACTIVE_PLAYER/phase errors.
If you want, I can implement these changes now in a branch and run the full test/build pipeline, but the plan above is precise so another teammate can pick up quickly and avoid rework.
