# `docs/tasks/0006-board-and-place-tile-action.md`

## Title

Introduce board state and the first core gameplay action: `core.placeTile`

## Goal

Add the minimal board representation and a deterministic tile placement action to the core engine, wired end-to-end (server + client).
No adjacency rules, no scoring, no hotspots, no influence markers, no deck yet. Just:

* Board coordinates
* A tile entity
* `core.placeTile` action
* Validation: empty cell, active player only, tile shape valid
* Snapshot renders a simple board view in the client (debug is enough)

---

## Non-negotiables

* **English-only identifiers** (coords, board, tile, placement, etc.).
* **Comments are mandatory** around coordinate choice and invariants.
* **Update `CHANGELOG.md`**.
* Do not implement real game rules beyond “place tile in empty cell”.
* Do not add tile drawing/deck logic yet.
* Keep core deterministic and pure.

---

## Design choices (must be explicit)

### Coordinate system (pick one and document it)

Use axial hex coordinates:

* `q: number`, `r: number`
* (no cube coords in state; derived only if needed)

Document in comments:

* why axial coords are used
* allowed coordinate range (for MVP you can allow any integer; later we will constrain)

### Board storage

Use a Map-like structure for fast lookups, but serializable:

* Store as `Record<string, PlacedTile>` where key is `"{q},{r}"`, or
* Store as array of entries `{ key, tile }`

Pick one and comment why.
Must be stable in JSON snapshots.

---

## Deliverables

### A) Core: Board + Tile types

In `packages/core`:

Add types:

* `HexCoord { q: number; r: number }`
* `Tile { id: string; kind: string; /* placeholder fields */ }`
* `PlacedTile { tile: Tile; coord: HexCoord; placedBy: string; placedAtTurn: number }`

Rules:

* `kind` is a string for now (e.g. `"generic"`). Later we’ll enforce actual tile types.
* `id` is unique.
* Do not introduce German terms for tile kinds.

Add to `GameState`:

* `board: { cells: Record<string, PlacedTile> }`

Invariants:

* A coordinate key may contain at most one placed tile.
* Board state changes only through actions.

---

### B) Core action: `core.placeTile`

Register schema for:

* type: `core.placeTile`
* payload:

  * `coord: { q: number; r: number }`
  * `tile: { id: string; kind: string }`  (MVP: client provides tile object; later we’ll only provide tileId from hand)

Validation rules:

1. actor must be active player (`NOT_ACTIVE_PLAYER`)
2. coord must be integers (schema)
3. coord key must not be occupied (`CELL_OCCUPIED`)
4. tile id must not already exist on board (`DUPLICATE_TILE_ID`)
5. tile.kind must be non-empty string

Apply behavior:

* Adds `PlacedTile` at coord with metadata:

  * `placedBy = actorId`
  * `placedAtTurn = state.turn`
* Emits event/log entry:

  * `"Player X placed tile <kind> at (q,r)"`

No adjacency validation. No turn advancement automatically.
(We will decide later whether placing ends turn; for now it does NOT.)

---

### C) Core: helper utilities (pure)

Add small pure utilities in core:

* `coordKey(coord) => string`
* `isCoordEqual(a,b)` (optional)
* Keep them tested.

Add comments: coordinate key stability is critical for determinism and replay.

---

### D) Server: no extra rules, just pass-through

In `apps/server`:

* Nothing “smart”: server must accept the action envelope and pass to core.
* Ensure request/session config doesn’t break.

Optional but recommended:

* Add a server-side rate limit for dispatch (tiny) OR leave it.

---

### E) Client: board debug rendering + placement interaction

In `apps/client`:

* Render a simple list/table of placed tiles with coords (debug view is enough).
* Add minimal interaction:

  * inputs for `q` and `r` (number fields)
  * “Place tile” button that dispatches `core.placeTile` with:

    * a generated tile id (use nanoid on client or ask server; simplest is client for now)
    * kind `"generic"` or a dropdown with a few placeholder kinds

Show errors from server clearly in UI debug panel.

Do not implement hex grid visuals yet unless it’s trivial. A list is fine.

---

### F) Tests

In `packages/core`:

1. placing tile in empty coord succeeds and updates board
2. placing in occupied coord fails with `CELL_OCCUPIED`
3. non-active player cannot place (`NOT_ACTIVE_PLAYER`)
4. duplicate tile id fails (`DUPLICATE_TILE_ID`)
5. snapshot remains serializable JSON (basic test)

Server integration tests (minimal):

* create session, join, dispatch `core.placeTile`, verify revision increments and snapshot contains board cell

---

### G) Changelog update (MANDATORY)

Append new dated entry:

* Added board state and coordinate system
* Added `core.placeTile` action with validation
* Added client debug placement UI
* Notes: “No adjacency/scoring yet; groundwork only”

---

## Acceptance criteria

* `pnpm dev` works
* Create session, join
* Place tile at (0,0) succeeds and appears in client
* Place another tile at (0,0) fails with `CELL_OCCUPIED`
* Place tile as non-active player fails with `NOT_ACTIVE_PLAYER`
* All builds/tests/lint pass
* No German identifiers
* Comments describe coordinate/key invariants

---

## Explicitly do NOT do

* No deck/hand/tile drawing
* No adjacency rules
* No hotspots or influence
* No end-of-turn automation on place
* No expansions touched

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---
