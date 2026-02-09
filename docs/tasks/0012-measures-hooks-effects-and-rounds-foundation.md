
# `docs/tasks/0012-measures-hooks-effects-and-rounds-foundation.md`

### Title

Measures foundation: activate hook pipeline, add round tracking, introduce effect layer, and scaffold measure deck/hand

### Goal

Before implementing more rules, establish the engine primitives that measures (and overlays / “until next turn” timing) depend on:

1. **Hook pipeline is actually executed** in `applyAction()` (not just declared).
2. Add an **unambiguous round model** (full table loop, start player wrap).
3. Introduce a **minimal effect layer** (duration, expiry, modifiers) in core state.
4. Provide a **shared, deterministic measure scaffold**: face-up row (3), draw/discard, hand limit, per-round playundenlimit, per-card max plays, single recycle.

This task must not implement real measure cards yet. It only builds the stable rails.

### Non-negotiables

* English-only identifiers in code.
* Comments where invariants/timing are implemented.
* Update `CHANGELOG.md`.
* Add tests in `packages/core` (Vitest).
* Deterministic ordering (no iteration over object keys without sorting).

---

## Deliverables

## A) Activate the hook pipeline in `applyAction()`

### Files

* `packages/core/src/expansion/engine.ts`
* `packages/core/src/expansion/types.ts` (types already exist – only extend if needed)

### Required behavior

In `applyAction(snapshot, action)` call hooks in this order:

1. **onBeforeActionValidate**: may inspect `snapshot`, `action`.
2. Payload validation (existing Zod schema check).
3. Core phase gates + active-player authorization (existing checks).
4. **onValidateAction**: can *reject* action with a structured engine error (new mechanism below).
5. Reducer application (core reducers + expansion reducers).
6. **onApplyAction**: after reducer chose a result, before final snapshot is committed (optional but useful).
7. Finalize snapshot (`revision`, `updatedAt`, log entry).
8. **onAfterAction**: post-commit, can add events (but must not mutate state).
9. **onSnapshot**: last pass to normalize/derive (must be deterministic).

### Implementation detail: hook error signaling

Add a tiny convention so hooks can veto:

```ts
type HookReject = { reject: { code: EngineErrorCode; message: string; details?: unknown } };
```

* `onValidateAction` handlers may return `HookReject`.
* Engine returns `{ ok:false, error: reject }` immediately.

**Do NOT** allow hooks to mutate core state arbitrarily. If you allow mutation, confine it to a single, documented hook (`onSessionCreate` already does that). Everything else should be *pure*.

### Acceptance Criteria

* A dummy hook registered by an expansion can block actions deterministically.
* Hooks are called exactly once per `applyAction` and in the documented order.

### Tests

Create: `packages/core/src/hooks.test.ts`

* Register a test expansion that:

  * records hook call order into `snapshot.state.extensions.test.calls`
  * rejects `core.drawTile` in `onValidateAction`
* Assert:

  * call order matches spec
  * rejection returns correct `EngineErrorCode`

---

## B) Add an explicit round model (not just `turn`)

### Files

* `packages/core/src/protocol/index.ts` (Zod schema)
* `packages/core/src/expansion/engine.ts`

### State additions (GameState)

Add:

* `round: number` (starts at 1)
* `turnInRound: number` (starts at 1, increments on each pass)
* `roundStartPlayerIndex: number` (starts at 0; stable for this round)

### Rule

On `core.passTurn`:

* compute `nextIndex = (activeIndex + 1) % players.length`
* if `nextIndex === roundStartPlayerIndex` then:

  * `round += 1`
  * `turnInRound = 1`
  * `roundStartPlayerIndex = nextIndex` (i.e. start player remains the same by default for now)
* else:

  * `turnInRound += 1`

*(Später könnt ihr Startspieler rotieren, aber dafür braucht ihr erst diese Basis.)*

### Acceptance Criteria

* After N passes where N = player count, `round` increments exactly once.
* `turn` (absolute counter) may continue to increment as today – **but round logic must be correct regardless**.

### Tests

Create: `packages/core/src/round.test.ts`

* Initialize session with 3 players.
* Execute sequence: placeTile → draw/pass loops to advance turns.
* Assert `round/turnInRound` transitions at correct points.

---

## C) Add a minimal effect layer (for “until next turn / end of next round / cost modifiers”)

### Files

* `packages/core/src/protocol/index.ts`
* New: `packages/core/src/effects.ts`
* `packages/core/src/expansion/engine.ts` (expiry tick)

### State additions

Add to `GameState`:

* `effects: ActiveEffect[]` (default empty)

Define (protocol + runtime schema) a minimal shape:

```ts
ActiveEffect = {
  id: string;
  source: { kind: 'measure' | 'overlay' | 'system'; ref?: string };
  ownerPlayerId?: string; // for “until your next turn”
  createdAtTurn: number;
  expires: { atTurn?: number; atRound?: number; atNextTurnOfPlayerId?: string };
  modifiers?: {
    blockActionTypes?: string[];
    costDeltaByResourceId?: Record<string, number>;
  };
}
```

### Engine behavior: expiry tick

On every successfully applied action (or at least on `core.passTurn`) run:

* `pruneExpiredEffects(snapshot)`:

  * expire if `expires.atTurn <= state.turn`
  * expire if `expires.atRound <= state.round`
  * expire if `expires.atNextTurnOfPlayerId === state.activePlayerId` **at the moment that player becomes active** (i.e. after pass)

Be explicit in comments: “until next turn” expires when the player becomes active again, not mid-turn.

### Hook usage example (no real measures yet)

In tests, use `onValidateAction` to check `effects.modifiers.blockActionTypes` and reject.

### Acceptance Criteria

* Effects can block actions without hardcoding in reducers.
* Effects expire deterministically based on turn/round rules.

### Tests

Create: `packages/core/src/effects.test.ts`

* Add an effect that blocks `core.drawTile` until next turn of player A.
* Assert it blocks immediately.
* Pass until A is active again → assert effect expired and draw works.

---

## D) Measure system scaffold (deck/row/hand limits + lifecycle), shared and deterministic

### Philosophy (important)

Measures are **not** “UI sugar”; they are rule objects. But we will not encode real cards now.

We will implement a generic engine utility that expansions can use:

* each expansion may own its own measure deck,
* but the state shape and invariants are consistent.

### Files

* New: `packages/core/src/measures/types.ts`
* New: `packages/core/src/measures/state.ts`
* New: `packages/core/src/measures/reducer.ts` (optional)
* `packages/core/src/protocol/index.ts` (if you store measure state in core, otherwise store under `extensions[expId]`)
* `packages/core/src/expansion/engine.ts` (action schema registration OR keep it expansion-side)

### Decide storage location (pick one, document it)

**Recommended now:** store per expansion under `extensions[expansionId].measures` to avoid core owning expansion content.

Shape:

```ts
MeasureState = {
  drawPile: string[];      // measure ids
  discardPile: string[];   // measure ids
  faceUp: string[];        // exactly 3 (or fewer if no cards left)
  recycled: boolean;
  playsByMeasureId: Record<string, number>;  // cap 2
  playedThisRoundByPlayerId: Record<string, boolean>; // cap 1 per round
  handByPlayerId: Record<string, string[]>;  // cap 2
}
```

### Generic helper functions (core)

* `initMeasureState({ playerIds, deckIds, seed })`
* `takeFaceUpMeasure(state, playerId, index)`
* `playMeasure(state, playerId, measureId)`
* `refillFaceUp(state)` (including one-time recycle rule)

### Invariants (enforce)

* faceUp length is 3 unless deck exhausted beyond recycle.
* player hand length ≤ 2
* per round: player may play ≤ 1 measure
* per game: each measure id may be played ≤ 2
* recycle: only once, when drawPile empty and discardPile non-empty → shuffle deterministically

### Deterministic shuffle

Use your existing deterministic approach (seed + stable RNG). If none exists yet for measures, implement a tiny seeded PRNG in core (documented) and use Fisher–Yates.

### Actions (scaffold only)

Do **not** implement real card effects yet. Only lifecycle:

* `exp.<id>.measure.take` payload `{ index: 0|1|2 }`
* `exp.<id>.measure.play` payload `{ measureId: string }`

Expansions can later interpret the played measureId via hooks/effects.

### Acceptance Criteria

* Taking a measure consumes the chosen faceUp slot and refills it deterministically.
* Playing a measure:

  * moves it to discard,
  * marks `playedThisRoundByPlayerId[player]=true`,
  * increments `playsByMeasureId`,
  * and does **not** itself apply effects yet (that comes next task).
* Round transition clears `playedThisRoundByPlayerId` automatically at `onRoundStart` (hook or engine tick).

### Tests

Create: `packages/core/src/measures.test.ts`

* init with known deck
* take → validate hand limit
* play → validate per-round and per-card caps
* drain deck → recycle happens once

---

## E) Update CHANGELOG

Add entry for task 0012 with:

* hooks activated
* round model added
* effects added
* measure scaffold added
* tests added

---

# Implementation Notes (where to wire what)

### Where to clear “playedThisRound”

Simplest: in `core.passTurn`, after calculating `round` increment:

* if round changed, clear the per-round flags for all measure states (iterate enabled expansions that have measure state).
  This keeps it deterministic and avoids adding a new hook right now.

### Where measure actions should be registered

Preferred: in the expansion package (e.g. `@bc/exp-economy`) using the registry:

* register the measure action schemas,
* register a reducer that updates `extensions[economy].measures`.

Core only provides the generic helper functions and types.

---

## “Done” definition (you can copy-paste into PR description)

* [ ] Hook pipeline implemented and tested.
* [ ] Round tracking added to protocol + engine and tested.
* [ ] Effect layer added, expiry implemented, tested.
* [ ] Measure lifecycle scaffold implemented with deterministic shuffle and tested.
* [ ] CHANGELOG updated.

---

# Quick next step after 0012

Task 0013 would be: “First real measure effects” (one per timing class: one-shot, until-next-turn, until-end-next-round, before-majority-check) implemented via effects + hooks. **Aber erst nachdem 0012 sauber grün ist.**

---
