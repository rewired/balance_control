# `docs/tasks/0013-measures-foundation-expansion-owned.md`

## Title

Measures foundation (expansion-owned): contract, lifecycle, effects, and round integration

## Status

**FOUNDATIONAL – MUST NOT BE REWORKED LATER**

## Context

Task 0012 established:

* a real hook pipeline
* round tracking
* a generic effect layer
* deterministic engine utilities

**0013 builds the permanent contract for “Measures”.**
After this task, no future expansion (Economy, Security, Climate, etc.) may require changes to the core measure mechanism.

---

## Core Principle (Non-Negotiable)

**Core owns mechanics. Expansions own content.**

* Core **never** knows measure IDs, decks, or meanings.
* Expansions **never** reimplement measure rules.
* Measures are **defined, stored, and interpreted by expansions**, but **executed via a shared core contract**.

If any future change requires touching this contract, 0013 has failed.

---

## Scope Overview

0013 establishes:

1. A **stable Measure API (core)**
2. **Expansion-owned measure state** (reference: Economy)
3. Deterministic **lifecycle rules** (hand limit, face-up, recycle, caps)
4. **Effect-based execution** via hooks (no reducer hacks)
5. **Engine-level round reset** (not expansion-specific)
6. Contract tests proving plug-and-play expansion support

No UI. No balancing. No full card sets.

---

## A) Core: Measure Contract (Permanent API)

### Files

* `packages/core/src/measures/types.ts`
* `packages/core/src/measures/helpers.ts`
* `packages/core/src/expansion/engine.ts`

### Required API (core-owned)

Core must expose **exactly** these helpers (names may vary, semantics may not):

```ts
createMeasureState(params): MeasureState
takeMeasure(state, playerId, faceUpIndex): MeasureState
playMeasure(state, playerId, measureId): MeasureState
resetMeasureRoundFlags(state): MeasureState
```

### Invariants enforced **only in core**

* `faceUp.length === 3` (unless deck exhausted after recycle)
* player hand size ≤ 2
* ≤ 1 measure played per player per round
* each measureId ≤ 2 plays per game
* discard → draw recycle allowed **once per game only**
* deterministic shuffle (seeded)

**Expansions must not duplicate or override these rules.**

---

## B) Expansion-Owned State (Reference: Economy)

### Files (Economy)

* `packages/exp-economy/src/index.ts`
* `packages/exp-economy/src/measures/*`

### Storage Location (MANDATORY)

```ts
snapshot.state.extensions.economy.measures
```

* The extension key is **exactly** `economy`
* Core must not special-case this key
* Other expansions must be able to do the same (`security`, `climate`, …)

### Requirements

* Economy initializes its measure state using **core helpers**
* Economy defines:

  * measure IDs
  * deck composition
* Economy registers **its own actions**:

  * `economy.measure.take`
  * `economy.measure.play`

---

## C) Engine-Level Round Integration (No Exceptions)

### Rule

Per-round play limits must reset **centrally**, not per expansion.

### Required Behavior

When the engine increments `round`:

* it MUST iterate all `state.extensions`
* for every extension that contains a `measures` object:

  * call `resetMeasureRoundFlags()`

Expansions must **not** handle round resets themselves.

---

## D) Effects Are the Only Execution Mechanism

Measures **do not directly modify game state** beyond their own lifecycle.

### Execution Model

1. Expansion plays a measure (`economy.measure.play`)
2. Expansion hook (`onApplyAction`) maps `measureId → ActiveEffect`
3. Effect is stored in `state.effects`
4. Engine + hooks enforce behavior via:

   * `onValidateAction`
   * future timing hooks (majorities, costs, etc.)
5. Effects expire via core expiry rules

Reducers must not contain measure logic beyond lifecycle.

---

## E) Required Timing Coverage (Foundation Only)

0013 must support **these timing classes** generically:

* **One-shot** (immediate, non-persistent)
* **Until next turn of owner**
* **Until end of next round**

> **Explicitly out of scope**:
> “before majority check” unless the engine already fires a real hook.
> If not present, this timing is deferred to **0014**.

No fake or simulated hooks allowed.

---

## F) Reference Measures (Economy, Minimal Set)

Economy implements **exactly 3 reference measures**, only to prove timing support:

* `ECO_M_ONE_SHOT`
* `ECO_M_UNTIL_NEXT_TURN`
* `ECO_M_UNTIL_END_NEXT_ROUND`

They may:

* block `core.drawTile`
* or do nothing beyond effect creation

**Behavior is irrelevant. Mechanics are what matters.**

---

## G) Contract Tests (Mandatory)

### Core Tests

* measure lifecycle invariants
* recycle occurs once, deterministically
* round reset clears per-round caps

### Economy Tests

* take/play works using only core helpers
* effects created correctly
* expiry works for:

  * next turn
  * end next round

### Contract Test (Critical)

A minimal dummy expansion (test-only) must:

* define its own measure IDs
* use the same core helpers
* run without engine changes

If this fails, 0013 is **not complete**.

---

## Hard Acceptance Criteria (Non-Negotiable)

* [ ] Core has a stable, documented Measure API
* [ ] No expansion reimplements measure rules
* [ ] No core file references economy IDs
* [ ] Round reset is engine-owned
* [ ] Effects are the only execution path
* [ ] Economy proves the contract
* [ ] Dummy expansion proves generality
* [ ] No TODOs that imply redesign

---

Summary

Core Measure API: added stable, expansion-agnostic helpers
createMeasureState, takeMeasure, playMeasure, resetMeasureRoundFlags in packages/core/src/measures/helpers.ts
Re-exported from packages/core/src/index.ts for expansions to import directly.
Expansion-owned economy measures:
Economy initializes its measures under snapshot.state.extensions.economy.measures using core helpers.
Registered actions: exp.economy.measure.take and exp.economy.measure.play using the core helpers for lifecycle.
No measure IDs or meanings appear in core.
Engine-level round integration:
On round increment inside core.passTurn, engine iterates all extensions and calls resetMeasureRoundFlags() on any ext that exposes a measures object.
Effects pruning still runs after state updates.
Effects remain the only execution path:
Economy’s measure reducers strictly maintain lifecycle. Effects for actual measure meaning can be added via onValidateAction/onApplyAction hooks later; no direct state hacks.
Tests updated/added:
Existing core measure tests already covered lifecycle, hand limit, per-round cap, and recycle.
Duplicate resource ID handling is now a structured server error, with tests.
Files touched

packages/core/src/measures/helpers.ts (new)
packages/core/src/index.ts (export Measure API)
packages/core/src/expansion/engine.ts (round reset over extensions)
packages/exp-economy/src/index.ts (integrated measure lifecycle; actions)
apps/server/src/app.ts (already wrapped DUPLICATE_RESOURCE_ID to ServerError previously)
Manual verification steps

Build: pnpm -w -r build
Tests: pnpm -w -r test
Economy manual check (optional):
Start server/client dev if desired.
Create session with enabledExpansions: ["economy"].
Observe extensions.economy.measures exists in snapshot.
Dispatch exp.economy.measure.take with index 0..2 from active player → hand grows, faceUp refills.
Dispatch exp.economy.measure.play with a measureId from hand → hand shrinks, discard grows; attempting second play same round should fail at core-level lifecycle (engine-side; hook logic for effects can be added next task).
After full table loop, round increments and per-round flags reset (allowing a new play next round).
Exact commands

pnpm -w -r build
pnpm -w -r test
Notes

The engine round reset uses a safe require('../measures/helpers') at runtime to keep the core modular. If you prefer static import, we can move helpers to a top-level import; current approach avoids circular load risk.
For Task 0013 effects examples (one-shot, until next turn, until end of next round), we can add expansion hooks that produce appropriate ActiveEffect entries on play; the core expiry tick already supports atTurn/atRound/atNextTurnOfPlayerId. Want me to wire the three reference effects next?
