# `docs/tasks/0007-tile-supply-hand-and-place-from-hand.md`

## Title

Introduce tile supply + per-player hand and enforce “place tile only from your hand”

## Goal

Add deterministic tile supply and per-player hands to the core engine. Change `core.placeTile` so it can only place a tile that is currently in the active player’s hand.

This establishes the baseline for the future rule:

> “On your turn, you place exactly one tile and then perform exactly one action.”

In this task we only implement:

* supply generation (deterministic)
* draw action
* hand state
* place-from-hand enforcement

No adjacency/scoring/hotspots yet.

---

## Non-negotiables

* **English-only identifiers**.
* **Comments are mandatory** around determinism, supply generation, and invariants.
* **Update `CHANGELOG.md`**.
* No real tile distribution rules yet; keep it generic but deterministic.
* Server remains authoritative.
* Avoid over-engineering; keep it minimal and testable.

---

## Deliverables

### A) Core: Tile supply + hand state

In `packages/core`, extend `GameState` with:

* `supply: { tiles: Tile[]; drawIndex: number }`

  * `tiles` is a pre-generated array
  * `drawIndex` points to next tile to draw
* `hands: Record<string, Tile[]>`

  * keyed by `playerId`
* Optional: `discard: Tile[]` (not required in this task)

Invariants (comment and enforce in code):

* `drawIndex` is never negative, never > `tiles.length`
* A tile id exists in exactly one location:

  * supply (undrawn), or a player hand, or placed on board (later discard)
* Hands must exist for all players.

---

### B) Deterministic supply generation (MVP)

Implement a deterministic tile generator in core:

* `generateSupplyTiles(config) => Tile[]`

MVP supply rules (simple, stable):

* Generate N tiles with ids `t0001...t00NN` or nanoid derived from seed.
* Kinds: choose from a small placeholder set like:

  * `"generic-a"`, `"generic-b"`, `"generic-c"`
* Deterministic order:

  * Either fixed order or shuffle using a seeded RNG.

**Seed requirement**
Add to session config:

* `seed: string`
* If user does not provide, server generates one and stores it in session config.

Add comments:

* determinism matters for replay and debugging
* seed is part of session config and snapshot

Avoid pulling in heavy RNG libs unless needed; simplest acceptable:

* implement a small seeded PRNG in core (document it), or
* use a tiny dependency already in repo (only if present). Keep it stable.

---

### C) Core: New action `core.drawTile`

Register a core action:

* type: `core.drawTile`
* payload: `{}`

Validation:

* actor must be active player
* supply must have remaining tiles (`SUPPLY_EMPTY`)
* hand size must not exceed a limit (MVP: 5) (`HAND_FULL`)

Apply behavior:

* take next tile from `supply.tiles[supply.drawIndex]`
* increment `drawIndex`
* push tile into active player hand
* emit event: `"Player X drew a tile"`

---

### D) Core: Update `core.placeTile` to place from hand

Change the existing `core.placeTile` action:

#### New payload

Instead of sending full tile object, payload must be:

* `coord: { q: number; r: number }`
* `tileId: string`

Validation additions:

* actor is active player (still)
* tileId must exist in active player hand (`TILE_NOT_IN_HAND`)
* tileId must not already be placed (`DUPLICATE_TILE_ID` still)
* coord empty (`CELL_OCCUPIED` still)

Apply behavior:

* remove tile from hand by id
* place onto board using that tile’s existing `{ id, kind }`
* emit event: `"Player X placed tile <kind> at (q,r)"`

**Do not** automatically advance the turn in this task.

---

### E) Session creation: initialize hands and initial draw

On session creation (core):

* initialize empty hands for each player
* optionally perform an initial draw:

  * e.g. each player draws 1 tile, or active player draws 2, etc.

**For this task, keep it minimal and explicit:**

* Do not auto-draw unless specified.
* Prefer: start with empty hands, user must click “Draw tile”.

(If you decide to auto-draw 1 tile for active player for usability, document it clearly and test it.)

---

### F) Server: seed plumbing

In `apps/server`:

* Extend `POST /api/session` to accept optional `seed`
* If not provided, generate one (simple random string) and persist it in session config
* Ensure snapshot includes seed

---

### G) Client: hand UI + draw/place from hand

In `apps/client`:

* Show active player’s hand (list of tiles with id + kind)
* Add button “Draw tile” that dispatches `core.drawTile`
* Update placement UI:

  * select a tile from hand (dropdown or clickable list)
  * dispatch `core.placeTile` with `tileId` and coord inputs
* Display errors clearly (`HAND_FULL`, `SUPPLY_EMPTY`, `TILE_NOT_IN_HAND`, etc.)

---

### H) Tests

In `packages/core`:

1. `core.drawTile`:

   * moves tile from supply to hand
   * increments drawIndex
2. `core.placeTile`:

   * requires tileId in hand
   * removes tile from hand and adds to board
3. Determinism:

   * same seed and config produce same initial supply order (and thus same first drawn tile)
4. Error cases:

   * supply empty
   * hand full
   * tile not in hand

Server tests (minimal):

* session creation returns seed if not supplied
* create session + join + draw tile + place tile works end-to-end

---

### I) Changelog update (MANDATORY)

Append dated entry:

* Added deterministic tile supply and per-player hands
* Added `core.drawTile`
* Updated `core.placeTile` to place from hand by tileId
* Notes: “No adjacency/scoring; no automatic turn end yet”

---

## Acceptance criteria

* `pnpm dev` works
* Create session, join
* Click “Draw tile” → active player hand shows 1 tile, revision increments, log entry
* Select tile from hand, place at (0,0) → succeeds, hand decreases, board updates
* Attempt to place a tileId not in hand → fails with `TILE_NOT_IN_HAND`
* Draw until supply empty or hand full triggers correct errors
* All builds/tests/lint pass
* No German identifiers
* Comments explain determinism and invariants

---

## Explicitly do NOT do

* No adjacency checks
* No turn ending on place/draw
* No scoring/hotspots/influence
* No real tile distribution from rulebook yet
* No expansions touched

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---
