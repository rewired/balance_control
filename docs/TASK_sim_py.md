# TASK_sim_py.md — Implement Python Simulation Engine for BALANCE // CONTROL

This task defines the **step-by-step implementation plan** for the deterministic Python simulation system described in `docs/AGENTS.md`.

Target audience: Codex / automated agents.  
Primary goal: **produce a working, testable, deterministic simulation backend** suitable for balance testing and LLM-vs-LLM tournaments.

Do not skip steps. Do not reorder unless necessary.

---

## PHASE 0 — Preconditions

### Inputs
- Repository: `rewired/balance_control`
- Reference document: `docs/AGENTS.md`

### Hard constraints
- Python only (3.11+)
- No UI
- Deterministic execution
- 3-player focus (0..2)
- Base Game + Expansion 1 + Expansion 2

If rules are ambiguous:
- Do NOT invent silently
- Document assumptions in `/sim_py/docs/ASSUMPTIONS.md`

---

## PHASE 1 — Project Skeleton

### Tasks
1. Create directory `/sim_py`
2. Inside `/sim_py`, create:
```

engine/
agents/
sim/
tests/
docs/

```
3. Add:
- `/sim_py/README.md`
- `/sim_py/pyproject.toml`

### Acceptance Criteria
- Repository structure matches `docs/AGENTS.md`
- `sim_py` is fully self-contained
- No code yet, only skeleton

---

## PHASE 2 — Core Engine Types & RNG

### Files to create
- `/sim_py/engine/rng.py`
- `/sim_py/engine/errors.py`
- `/sim_py/engine/types.py`

### Required content
- Seeded RNG wrapper (single source of randomness)
- Stable ID generators (tiles, actions)
- Typed enums / dataclasses for:
- TileCategory
- ActionType
- ResourceType
- ExpansionFlags

### Acceptance Criteria
- Given the same seed, RNG produces identical sequences
- No global random usage
- All IDs are deterministic

---

## PHASE 3 — Game State Model

### Files to create
- `/sim_py/engine/state.py`
- `/sim_py/engine/tiles.py`

### Required content
Implement explicit state containers:
- `GameState`
- `PlayerState`
- `BoardState`
- `TileInstance`

Board must support:
- adjacency queries
- per-tile per-player influence counts

### Acceptance Criteria
- State can be deep-copied or immutably replaced
- No hidden or derived state without documentation
- Board adjacency is queryable without heuristics

---

## PHASE 4 — Actions & Legality

### Files to create
- `/sim_py/engine/actions.py`
- `/sim_py/engine/legal.py`
- `/sim_py/engine/apply.py`

### Required action set
- PLACE_TILE
- PLACE_INFLUENCE
- MOVE_INFLUENCE
- FORMALIZE_INFLUENCE
- CONVERT_RESOURCES
- PASS

### Required behavior
- `get_legal_actions(state)` returns **only** legal actions
- `apply_action(state, action)`:
- validates
- applies exactly one action
- returns a new valid state

### Acceptance Criteria
- No illegal action can be applied
- PASS is available when appropriate
- Action objects are JSON-serializable

---

## PHASE 5 — Majority & Control Resolver

### Files to create
- `/sim_py/engine/resolver.py`

### Required behavior
- Centralized majority resolution
- Tie ⇒ blocked (no control)
- Same resolver used for:
- end-of-round payouts
- brenpunkt checks
- expansion modifiers

### Acceptance Criteria
- Resolver is the only place where control is decided
- Tie behavior is consistent everywhere
- Unit-testable in isolation

---

## PHASE 6 — Base Game Rules

### Files to create
- `/sim_py/engine/rules_base.py`

### Required behavior
- Base tile effects
- Base resources
- Base influence rules
- Brennpunkt trigger & resolution (tie ⇒ no effect)

### Acceptance Criteria
- Full base game playable end-to-end
- No expansion logic included here
- All rules documented via docstrings

---

## PHASE 7 — Expansion 1: Economy & Work

### Files to create
- `/sim_py/engine/rules_expansion_01_economy.py`

### Required behavior
- Economy / work tiles
- Ongoing production or conversion mechanics
- Integration via rule hooks (not engine branching)

### Acceptance Criteria
- Expansion can be toggled on/off
- Economy effects are measurable (metrics-ready)
- No duplication of base rules

---

## PHASE 8 — Expansion 2: Safety & Order

### Files to create
- `/sim_py/engine/rules_expansion_02_order.py`

### Required behavior
- Order / safety mechanics implemented as modifiers:
- movement restrictions or costs
- majority stickiness
- repression-style costs for aggressive actions
- Effects must be formal, not narrative

### Acceptance Criteria
- Order mechanics reduce board volatility
- Effects are deterministic
- Can be cleanly disabled

---

## PHASE 9 — Ruleset Composition

### Files to create
- `/sim_py/engine/ruleset.py`

### Required behavior
- Compose:
- base
- base + exp1
- base + exp2
- base + exp1 + exp2
- Hook-based execution:
- on_turn_start
- on_action_applied
- on_round_end
- modify_majority_context

### Acceptance Criteria
- No scattered `if expansion:` checks
- Rulesets are swappable without code changes

---

## PHASE 10 — Agents

### Files to create
- `/sim_py/agents/base.py`
- `/sim_py/agents/random_legal.py`
- `/sim_py/agents/heuristic_institution.py`
- `/sim_py/agents/heuristic_network.py`
- `/sim_py/agents/heuristic_production.py`
- `/sim_py/agents/llm_agent.py`

### Required behavior
- All agents implement `choose_action(state, legal_actions)`
- Heuristic agents are deterministic
- LLM agent:
- strict JSON output
- retries on invalid output
- deterministic fallback

### Acceptance Criteria
- Agents never crash the engine
- LLM agent can be stubbed (no API key required)
- Network agent actively seeks ties / blockades

---

## PHASE 11 — Simulation Runner & Tournament

### Files to create
- `/sim_py/sim/runner.py`
- `/sim_py/sim/tournament.py`
- `/sim_py/sim/metrics.py`
- `/sim_py/sim/export.py`
- `/sim_py/sim/cli.py`

### Required behavior
- Run single game
- Run N games across seeds
- Rotate seating positions
- Export JSON + CSV

### Acceptance Criteria
- ≥ 1,000 games run without crash
- Identical seeds ⇒ identical outputs
- Metrics match definitions in AGENTS.md

---

## PHASE 12 — Metrics Documentation

### Files to create
- `/sim_py/docs/METRICS.md`

### Required content
- Definition of every metric
- Definition of “stagnation turn”
- Explanation of brenpunkt effectiveness

### Acceptance Criteria
- Metrics are unambiguous
- All exported metrics are documented

---

## PHASE 13 — Tests

### Files to create
- `/sim_py/tests/test_determinism.py`
- `/sim_py/tests/test_legal_actions.py`
- `/sim_py/tests/test_resolver.py`
- `/sim_py/tests/test_expansion_01.py`
- `/sim_py/tests/test_expansion_02.py`
- `/sim_py/tests/test_smoke.py`

### Required tests
- Determinism (same seed ⇒ same hash)
- Legal action validity
- Tie behavior
- Economy payout correctness
- Order restriction correctness
- Smoke test: 100 random games

### Acceptance Criteria
- All tests pass
- Determinism proven for all rulesets

---

## PHASE 14 — Finalization

### Required files
- `/sim_py/docs/ASSUMPTIONS.md`
- `/sim_py/README.md` (how to run)

### Acceptance Criteria
- Assumptions explicitly documented
- README explains:
- how to run one game
- how to run a tournament
- how to enable expansions

---

## PULL REQUEST CHECKLIST

Before marking this task complete, verify:

- [ ] `/sim_py` matches structure in `AGENTS.md`
- [ ] Base game runs end-to-end
- [ ] Expansions 1 & 2 toggle independently
- [ ] Determinism tests pass
- [ ] ≥ 3 heuristic agents implemented
- [ ] LLM agent stub exists
- [ ] Tournament runner exports metrics
- [ ] No undocumented rule assumptions
- [ ] No UI code added
- [ ] Code is readable and boring

---

## Final note

This system exists to **measure balance, not to be fun**.

If a design choice makes the engine simpler and the analysis clearer,
prefer that choice—even if it makes the game feel less “alive”.
