# `docs/tasks/0011-influence-markers-and-basic-majority.md`

## Title

Influence markers: place/move with cap=3 and basic majority evaluation per tile

## Goal

Implement influence markers as a core mechanic with strict invariants:

* Players can **place** influence markers onto an existing tile
* Players can **move** influence markers between tiles
* Each player may have at most **3 influence markers per tile** (cap=3)
* The system can compute **majority ownership** on a tile:

  * who leads (playerId), or tie / no influence

This is the foundation for later rules (committees, lobbyists, hotspots, noise).
In this task:

* No hotspots
* No scoring
* No special effects on tie
* No economy/expansion influence rules

---

## Non-negotiables

* English-only identifiers (influence, marker, majority, tie, etc.).
* Comments mandatory around invariants and why majority is computed (not applied).
* Update `CHANGELOG.md`.
* Deterministic behavior and ordering.
* Server authoritative.
* Keep it minimal and testable.

---

## Deliverables

### A) Core: Influence model and storage

In `packages/core` add influence state to `GameState`.

Choose one storage model and document why:

**Preferred (simple + serializable):**

* `influenceByCoord: Record<CoordKey, Record<PlayerId, number>>`

Where:

* `CoordKey` is the existing `"{q},{r}"` key
* inner map counts markers per player on that tile

Invariants:

* counts are integers
* 0..3 per player per tile (cap=3)
* no negative values
* no entries for missing tiles (cannot place influence on empty cell)

Add comments: this structure is expansion-safe and deterministic.

---

### B) Core: Actions

Register two new core actions:

#### 1) `core.placeInfluence`

Payload:

```json
{
  "coord": { "q": number, "r": number },
  "amount": 1
}
```

Rules:

* actor must be active player
* target coord must contain a placed tile (`TILE_NOT_FOUND`)
* amount must be 1 for MVP (schema enforces)
* placing must not exceed cap (3) for that player on that tile (`INFLUENCE_CAP_REACHED`)
* increments influence count on that tile for actor

Emit event:

* `"Player X placed influence at (q,r)"`

#### 2) `core.moveInfluence`

Payload:

```json
{
  "from": { "q": number, "r": number },
  "to": { "q": number, "r": number },
  "amount": 1
}
```

Rules:

* actor must be active player
* both coords must contain tiles (`TILE_NOT_FOUND`)
* actor must have at least `amount` influence at `from` (`INSUFFICIENT_INFLUENCE`)
* moving must not exceed cap at `to` (`INFLUENCE_CAP_REACHED`)
* decrement from, increment to (atomic)

Emit event:

* `"Player X moved influence from (q1,r1) to (q2,r2)"`

**Phase enforcement**
Respect the current turn-phase model you have (place → optional action → pass):

* `placeInfluence` and `moveInfluence` must be treated as the “optional action” step (non-placement action).
* Therefore: allowed only in `"awaitingAction"` (or equivalent), not before placement.

If your phase machine isn’t implemented yet, implement the minimal phase checks required to enforce:

* `placeTile` is the placement step
* influence actions are optional-action step
* pass ends turn

(Do not expand beyond what’s needed.)

---

### C) Core: Majority evaluation (pure function)

Add a pure function:

* `getTileMajority(state, coord) => { leaderId: string | null; isTie: boolean; max: number }`
Note (later phase): Prefer `computeMajority(state, coord)` and `getControlLeaderId(state, coord)`; `getTileMajority` now delegates to the central service.

Rules:

* If no influence placed: `leaderId=null, isTie=false, max=0`
* If multiple players share max count: `leaderId=null, isTie=true`
* If one player strictly max: `leaderId=that player`

Determinism requirement:

* When iterating players/counts, always use a stable order (e.g., `players[]` order). Comment why.

Do not apply any effects. Just compute.

---

### D) Snapshot and client debug UI

In `apps/client`, show:

* influence counts per tile in a readable form

  * at least: list rows like `(q,r): p1=2 p2=1`
* majority output for a selected coord (simple input q/r + “compute majority” button OR auto compute when coord selected)
* add buttons for:

  * “Place influence (amount 1) at coord”
  * “Move influence (amount 1) from coord to coord”

Keep it debug-grade.

Show structured errors in UI.

---

### E) Tests

In `packages/core`:

* place influence on a tile increases count
* cap=3 enforcement works
* move influence decreases/increases correctly, atomic behavior
* cannot place/move on empty coord
* phase enforcement:

  * influence action before placement fails (if phase machine exists)
* majority:

  * leader correct when one player > others
  * tie recognized correctly
  * no influence returns null/no tie

Server integration tests:

* create session
* draw/place tile
* place influence on that tile
* verify snapshot contains influence map
* compute majority via core helper or validate expected state

---

### F) Changelog update (MANDATORY)

Add entry:

* Added influence marker storage and invariants (cap 3 per player per tile)
* Added `core.placeInfluence` and `core.moveInfluence`
* Added majority evaluation helper (no effects yet)
* Notes: “Foundation for hotspots/scoring/noise later”

---

## Acceptance criteria

* `pnpm dev` works
* Flow:

  1. draw tile
  2. place tile
  3. place influence (awaitingAction)
  4. pass turn
* Cap enforcement works at 3
* Majority helper yields correct leader/tie
* All builds/tests/lint pass
* No German identifiers
* Comments explain invariants and determinism

---

## Explicitly do NOT do

* No hotspots/brennpunkte
* No scoring
* No noise/tie penalties
* No committees/lobbyists
* No overlay mechanics
* No expansion influence rules

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---

Summary

Current status: Tasks 0009 and 0010 are implemented end‑to‑end; 0011 is partially implemented. Build, tests, and lint all pass locally after minor fixes.
Core highlights:
Session-scoped resource registry with base ids: domestic, foreign, media. Map-based pools per player.
Tiles carry production maps; passTurn resolves production deterministically (sorted by board key) and emits a resourceResolution event.
Deterministic supply generator (seeded LCG) with stable ids/kinds. Hands + draw/placement validated.
Strict turn phases: awaitingPlacement → awaitingAction → awaitingPass. Phase gates on placeTile/draw/pass enforce sequencing.
Expansion (economy):
@bc/exp-economy registers ResourceDef("economy") and appends 5 deterministic economy tiles via a generic onSessionCreate hook; no core special-casing.
Influence (0011):
Added state slot influenceByCoord and two actions core.placeInfluence and core.moveInfluence with cap 3, tile existence checks, and phase gates (count as the “optional action”; move to awaitingPass after).
Missing: majority helper getTileMajority; client debug UI for influence; server/core tests covering influence; changelog entry for 0011. (later replaced by computeMajority).
Notable decisions/deviations:
Initial snapshot deals 1 tile to each player so turn 1 can place (documented determinism; helps demo flow).
Board stored as JSON-stable array of { key, tile } where key is “q,r”; key stability called out in comments.
Fixes made while verifying:
Removed stray “\n” artifacts in core engine action registration/imports that broke TypeScript parse.
Added influenceByCoord: {} to both initial state creators.
Replaced any casts in economy expansion with typed unknown→as to satisfy lint; restored let in a test to keep semantics.
Build/lint/test status after fixes: all green.
Files Touched

CHANGELOG.md
packages/core/src/engine.ts
packages/core/src/expansion/engine.ts
packages/core/src/protocol/index.ts
packages/core/src/supply.test.ts
packages/exp-economy/src/index.ts
Manual Verification Steps

Core phases + turn:
Run dev and create a session from client.
Place the single starting hand tile, observe phase → awaitingAction.
Click “Draw tile” (allowed only in awaitingAction), observe phase → awaitingPass.
Click “Pass turn”, observe resourceResolution event and turn/active player advance.
Economy resource (server-level):
Create session with enabledExpansions: ["economy"] (see commands). Fetch snapshot to verify:
resources.registry includes "economy"
resourcesByPlayerId contains economy: 0 for each player
Draw until an economy-1 tile appears, place it, then passTurn; verify passing player’s economy increases by +1.
Note: client’s “Create session” currently posts enabledExpansions: []; for manual demo, temporarily send economy via curl (or adjust the request in apps/client/src/App.tsx).
Influence (partially wired):
Actions are registered and phase gated, but no UI and no tests yet. You can dispatch via Socket.IO with action types core.placeInfluence and core.moveInfluence to see state changes in influenceByCoord; pass remains required to end the turn.
Exact Commands

One-pass CI smoke on local machine:
pnpm ci:smoke
Build everything:
pnpm -w -r build
Run all tests:
pnpm -w -r test
Lint all packages:
pnpm -w -r lint
Dev servers (client + server concurrently):
pnpm dev
Preview a built client with server (static):
pnpm --filter @bc/client build
cross-env SERVE_STATIC=1 pnpm --filter @bc/server start
Create session with economy enabled (server only, for manual check):
PowerShell:
$body = @{ enabledExpansions = @('economy'); players = @(@{ id='p1'; name='Player 1' }, @{ id='p2'; name='Player 2' }) } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/session -ContentType 'application/json' -Body $body
curl:
curl -s -X POST http://localhost:3000/api/session -H "Content-Type: application/json" -d "{ \"enabledExpansions\":[\"economy\"], \"players\":[{\"id\":\"p1\"},{\"id\":\"p2\"}] }"
What Remains (0011 completion plan)

Core:
Add pure majority helper and export:
File: packages/core/src/influence.ts
Function: getTileMajority(state, coord) => { leaderId: string | null; isTie: boolean; max: number }
Note: In current core, use `computeMajority` for totals and `getControlLeaderId` for relative control.
Iterate players in players[] order for determinism; ignore tiles with no influence.
Tests (packages/core):
placeInfluence increases count; cap=3 enforced; moveInfluence atomic; errors: TILE_NOT_FOUND, INSUFFICIENT_INFLUENCE; phase enforcement; majority variations (leader / tie / none).
Server:
Minimal integration test: create session → draw/place → placeInfluence → assert influenceByCoord snapshot; optionally exercise moveInfluence.
Client:
Debug UI:
List influence per tile (e.g., “(q,r): p1=2, p2=1”).
Buttons: “Place influence” (awaitingAction), “Move influence” (awaitingAction).
Majority readout for an input coord (compute via helper if exposed or mirror logic client-side temporarily).
Changelog:
Append explicit 0011 entry with actions, storage, invariants, and majority helper; note that no scoring/hotspots/noise are implemented.
Minor cleanup:
CHANGELOG “turn phases” section has visible CR/LF tokens in the text; reformat to plain markdown bullets (content is correct).
If you want, I can finalize 0011 (helper, tests, UI) and tidy the CHANGELOG section next.

---

Summary

Implemented Task 0011 core pieces and finished integration:
Core: added pure majority helper getTileMajority(state, coord) with deterministic player-order iteration.
Core (later): replaced by `computeMajority`/`getControlLeaderId` as the single logic source.
Core: influence actions are already registered and phase‑gated; added focused tests for influence and majority.
Client: extended debug UI to list influence per tile, place/move influence, and show majority for a coord.
Economy: kept unchanged; no core special-casing (0010 remains valid).
Cleanup: removed stray backup file (apps/client/src/App.tsx.bak).
All packages now build, test, and lint cleanly.
Files Touched

CHANGELOG.md
packages/core/src/influence.ts
packages/core/src/influence.test.ts
packages/core/src/index.ts
packages/core/src/engine.ts
packages/core/src/expansion/engine.ts
packages/core/src/protocol/index.ts
packages/core/src/supply.test.ts
packages/exp-economy/src/index.ts
apps/client/package.json
apps/client/src/App.tsx
Removed: apps/client/src/App.tsx.bak
Manual Verification Steps

Start dev:
pnpm dev
Create a session in the client UI (defaults to two players).
Placement → optional action → pass:
Place any tile from the active hand at (q,r) → phase becomes awaitingAction.
Place influence: set iq/ir, click “Place influence” → phase becomes awaitingPass.
Pass turn → check event log and next active player.
Move influence:
Ensure there are two tiles on the board (across turns).
On your turn: place a tile (awaitingAction), set fromQ/fromR and toQ/toR, click “Move influence” → phase becomes awaitingPass.
Majority:
Enter iq/ir of a placed tile; majority block shows leader, tie flag, and max value.
Economy (optional):
Start server separately and create a session via API with "enabledExpansions": ["economy"].
Draw until an economy tile appears, place it, then pass; resources show economy increment.
Exact Commands

Build all: pnpm -w -r build
Test all: pnpm -w -r test
Lint all: pnpm -w -r lint
Run dev (server + client): pnpm dev
Preview built client via server:
pnpm --filter @bc/client build
cross-env SERVE_STATIC=1 pnpm --filter @bc/server start
Create session with economy (server running on 3000):
PowerShell:
$body = @{ enabledExpansions = @('economy'); players = @(@{ id='p1'; name='Player 1' }, @{ id='p2'; name='Player 2' }) } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/session -ContentType 'application/json' -Body $body
curl:
curl -s -X POST http://localhost:3000/api/session -H "Content-Type: application/json" -d "{ \"enabledExpansions\":[\"economy\"], \"players\":[{\"id\":\"p1\"},{\"id\":\"p2\"}] }"
If you want, I can add a minimal server test for influence interactions next (create session → place → placeInfluence → assert snapshot.influenceByCoord) and tidy the CHANGELOG “turn phases” paragraph formatting.

