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
