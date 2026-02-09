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
