# `docs/tasks/0005-core-turn-and-pass-action.md`

## Title

Core turn system and first real base-game action: `core.passTurn`

## Goal

Introduce the **first real base-game rule** into the core engine:

* A deterministic **turn system**
* Player order and “current player”
* A legal, rule-relevant **base action**: `core.passTurn`

This establishes:

* player identity
* turn ownership
* action authorization
* the invariant “only the active player may act”

No tiles, no board, no scoring yet.

---

## Non-negotiables

* **English-only identifiers** everywhere.
* **Comments are mandatory**, especially around turn invariants.
* **Update `CHANGELOG.md`**.
* No UI fancy work.
* No expansions touched.
* No implicit behavior: everything must be explicit and validated.

---

## Conceptual framing (important)

This task defines **what a turn is** in software terms.

A “turn” means:

* exactly one **active player**
* only that player may dispatch turn-bound actions
* after a successful turn-ending action, control moves deterministically

Later rules (place tile, play measure, etc.) will *compose on top of this*.

---

## Deliverables

### A) Core: Player model (minimal)

In `packages/core`:

Introduce a **Player** concept in the core state.

Minimal structure example (exact shape up to you, but must include):

* `id: string`
* `index: number` (turn order)
* `name?: string` (optional, for UI/debug)
* future-proof but minimal

Add to `GameState`:

* `players: Player[]`
* `activePlayerIndex: number`

Rules:

* Order is fixed for now.
* No elimination, no skipping, no modifiers.

---

### B) Core: Turn state and invariants

Extend `GameState` with:

* `turn: number` (starts at 1)
* `activePlayerId` OR derive from `activePlayerIndex` (choose one; document why)

Add invariants (document in comments):

* exactly one active player at all times
* `activePlayerIndex` is always valid
* turn counter increments only when a turn ends

---

### C) Core action: `core.passTurn`

Register a new **core action schema**:

* Action type: `core.passTurn`
* Payload: empty object `{}`

Validation rules:

* action must come from the **active player**
* action must be dispatched in a valid session state

Apply behavior:

* advance `activePlayerIndex` to next player (wrap around)
* increment `turn` counter
* emit a log/event entry like:

  * `"Player A ended their turn"`

Rejection rules:

* if actorId ≠ active player → error `NOT_ACTIVE_PLAYER`
* malformed payload → validation error

---

### D) Core engine integration

Ensure:

* turn logic runs **inside** the core engine
* no server-side “help”
* no client-side assumptions

`applyAction` must:

* validate actor authority
* route through schema registry
* apply reducer/effect
* return updated snapshot + events

Add comments explaining:

* why turn logic lives in core
* why server must not override it

---

### E) Server: session creation with players

In `apps/server`:

Extend session creation (`POST /api/session`) to accept:

```json
{
  "players": [
    { "id": "p1", "name": "Player 1" },
    { "id": "p2", "name": "Player 2" }
  ]
}
```

Rules:

* minimum 2 players
* maximum can be generous (e.g. 6), but document it
* order is the array order
* default fallback (if omitted): generate 2 placeholder players

Validate strictly.

Store players in session config/state.

---

### F) Server: actorId enforcement

Ensure:

* `client:dispatch` must include `actorId`
* server rejects actions without actorId
* server passes actorId unchanged into core

Add structured error:

* `ACTOR_NOT_ALLOWED`
* `NOT_ACTIVE_PLAYER`

---

### G) Client: minimal turn UI

In `apps/client`:

Extend debug UI to show:

* list of players
* highlight active player
* current turn number

Add a button:

* “Pass turn”
* dispatches `core.passTurn` with correct `actorId`

For hotseat:

* client may change `actorId` automatically when turn advances
* **but** server remains the authority

No player switching UI needed beyond this.

---

### H) Tests

Add tests in `packages/core`:

1. Initial state:

   * turn = 1
   * active player is players[0]
2. `core.passTurn`:

   * advances active player
   * wraps correctly
   * increments turn
3. Rejection:

   * non-active player cannot pass
   * missing actorId rejected

Server tests:

* session creation with players works
* dispatch with wrong actorId is rejected

---

### I) Changelog update (MANDATORY)

Append a new entry to `CHANGELOG.md`:

Include:

* Added player and turn system to core
* Added first real base-game action `core.passTurn`
* Notes: “Foundation for all future gameplay actions”

Do not rewrite older entries.

---

## Acceptance criteria

* `pnpm dev` works
* Create session with players
* Client shows players + active player
* Clicking “Pass turn”:

  * advances active player
  * increments turn
  * logs event
* Non-active player action fails cleanly
* All builds, tests, lint pass
* No German identifiers
* Comments explain invariants

---

## Explicitly do NOT do

* Do not add tile placement.
* Do not add board logic.
* Do not add scoring, resources, or influence.
* Do not touch expansion packages.
* Do not add UI beyond debug needs.

---

## Output requirements (Codex must report)

1. Summary
2. Files touched
3. Manual verification steps
4. Exact commands

---
