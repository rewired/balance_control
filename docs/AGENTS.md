# AGENTS.md — BALANCE // CONTROL (Python Simulation + LLM Tournaments)

This repository contains the BALANCE // CONTROL ruleset and documentation.  
Your task (Codex/agents) is to implement a **deterministic simulation engine** in **Python** for:

- Base Game
- Expansion 1: Economy & Work
- Expansion 2: Safety & Order

Primary use-case: **balance testing via high-volume self-play**, including **LLM vs LLM**.

This is an engineering rig. Keep it boring and measurable.

---

## 0) Non-negotiables

### Determinism
- All randomness must be **seeded**.
- Same seed + same agents + same ruleset => identical results.
- No hidden randomness in agents; if needed, use the engine RNG.

### Engine is the judge
- The engine is the single source of truth for:
  - legal action generation
  - state transitions
  - majority/control resolution
  - scoring

### No UI
- Do not build a UI.
- Provide CLI runners and exportable metrics (JSON/CSV).

### Separation
- `/engine` must not import `/agents` or any LLM SDK.
- LLM integrations live in `/agents` and `/sim`.

---

## 1) Where to implement (required folders)

Create the following at repo root:

```

/sim_py
/engine
/agents
/sim
/tests
/docs
pyproject.toml
README.md

```

Notes:
- Keep the Python system self-contained under `/sim_py`.
- Do not restructure existing repo docs unless necessary.

---

## 2) Python version & dependencies

- Python: **3.11+**
- Keep dependencies minimal.
- Allowed (optional):
  - `pydantic` (validation)
  - `numpy`, `pandas` (metrics only, not required)
  - `pytest` (tests)

No heavy frameworks.

---

## 3) Engine modules (required)

```

/sim_py/engine
**init**.py
rng.py
errors.py

types.py          # enums, dataclasses, ids
state.py          # GameState, PlayerState, BoardState
tiles.py          # tile definitions & categories
actions.py        # Action model + serialization
legal.py          # get_legal_actions(state)
apply.py          # apply_action(state, action) -> new_state

resolver.py       # majority, control, tie handling, modifiers
scoring.py        # end game scoring + winner

rules_base.py
rules_expansion_01_economy.py
rules_expansion_02_order.py
ruleset.py        # composition of base + expansions

```

---

## 4) Data model requirements

### IDs
- Tiles must have stable unique IDs (`T0001`, `T0002`, …) for reproducible logs.
- Players are `0..2` (3-player focus first).

### GameState (minimum)
- `seed: int`
- `rng_state: ...` (whatever your RNG needs)
- `round: int`
- `turn: int` (monotonic counter)
- `current_player: int`
- `players: list[PlayerState]`
- `board: BoardState`
- `deck: DeckState` (or bag)
- `expansions: ExpansionsConfig`
- `history: list[Event]` (optional but recommended)

### PlayerState (minimum)
- `influence_pool: int`
- `resources: dict[str, int]` (base + expansions)
- any expansion bookkeeping (e.g., order tokens) if needed

### BoardState (minimum)
- placed tiles: position + adjacency
- influence markers per tile per player
- helper indices for adjacency lookups

---

## 5) Action system (required)

Represent actions as typed dicts or dataclasses; must be JSON-serializable.

Minimum action set:

- `PLACE_TILE(tile_type, placement_ref, orientation?)`
- `PLACE_INFLUENCE(tile_id)`
- `MOVE_INFLUENCE(from_tile_id, to_tile_id)`
- `FORMALIZE_INFLUENCE()`
- `CONVERT_RESOURCES(conversion_id | from/to)`
- `PASS()`

### Legal action generation
The engine must implement:

- `get_legal_actions(state) -> list[Action]`

Agents must only pick from this list.

### Applying actions
- `apply_action(state, action) -> new_state`
- Must be safe + validated.
- Never silently accept illegal actions.

---

## 6) Majority/control resolver (critical)

Implement a single canonical resolver pipeline:

- majority is based on influence markers
- ties => **blocked** (no control / no effect)
- modifiers are applied via a consistent hook system

Modifiers must support:
- adjacency bonuses (e.g., lobby-like)
- expansion 2 order/safety effects (movement restrictions/costs, “stickiness”)

All majority checks must use the same resolver, including:
- end-of-round payouts
- brenpunkt triggers
- any expansion-specific checks

---

## 7) Ruleset composition (required)

Implement a `RuleSet` that can be configured:

- base only
- base + exp1
- base + exp2
- base + exp1 + exp2

The engine should call rule hooks, e.g.:

- `on_turn_start(state)`
- `on_tile_placed(state, tile_id)`
- `on_action_applied(state, action)`
- `on_round_end(state)`
- `modify_majority_context(ctx)` (inject modifiers)

Avoid littering `if exp2:` everywhere.

---

## 8) Expansion guidance

### Expansion 1: Economy & Work
- Add new tiles/resources/mechanics exactly as per the game docs.
- Ensure effects are measurable via metrics:
  - production/payout amounts
  - conversions used
  - control stability on economy/work tiles

### Expansion 2: Safety & Order
Implement safety/order as formal mechanics:
- influence movement restrictions or additional costs
- majority “stickiness” (harder to flip control)
- additional costs to aggressive actions (repression-like effect)

If any rule is ambiguous:
- record it in `/sim_py/docs/ASSUMPTIONS.md`
- implement consistently (no silent invention)

---

## 9) Agents (required)

All agents implement:

- `choose_action(state, legal_actions) -> Action`

Create:

- `random_legal.py` (deterministic random choice using engine RNG)
- `heuristic_institution.py` (committee/formalization focused)
- `heuristic_network.py` (tie creation + work/order anchors)
- `heuristic_production.py` (economy engine + conversion focus)
- `llm_agent.py` (LLM adapter, optional runtime dependency)

### LLM agent requirements
- Output must be strict JSON action, no prose.
- Prompt must include:
  - compact state summary
  - list of legal actions (with action IDs)
- Invalid JSON / illegal actions:
  - retry up to N=2
  - then deterministic fallback:
    - PASS if legal else first legal action in sorted order

**Default tournament temperature: 0.0** (deterministic).

---

## 10) Simulation & tournament harness (required)

```

/sim_py/sim
runner.py       # run_one_game(...)
tournament.py   # many games, seat rotation
metrics.py      # metric extraction + aggregation
export.py       # JSON/CSV export
cli.py          # argparse entrypoints

```

Must support:
- seat rotation (control seat bias)
- many seeds
- ruleset toggles
- agent selection via CLI

---

## 11) Metrics (must-have)

At minimum per game:

- `winner`
- `rounds_played`
- `final_influence_on_board_by_player`
- `formalizations_by_player`
- `blocked_majority_checks_count`
- `brenpunkt_triggered_count`
- `brenpunkt_effective_count` (non-tie)
- `influence_moves_count`
- `pass_count`
- `stagnation_turns` (define in docs)

Also record per-round time series:
- influence on board per player
- resource totals per player

Document in `/sim_py/docs/METRICS.md`.

---

## 12) Tests (required)

Use `pytest`.

Mandatory tests:

1) Determinism:
- same seed + same agents => identical final state hash
- cover:
  - base
  - base+exp1
  - base+exp2
  - base+exp1+exp2

2) Legal actions:
- generated actions are valid
- applying any legal action results in valid state

3) Resolver:
- majority, tie blocking
- modifier application
- order movement restrictions/costs
- economy payout correctness

4) Smoke:
- 100 games with `random_legal` must complete without exceptions.

---

## 13) Deliverables (definition of done)

1) `sim_py` builds/runs locally (document in `sim_py/README.md`).
2) CLI can run:
   - one game
   - a tournament of >= 1,000 games
3) Exports JSON/CSV metrics deterministically.
4) Tests pass.
5) Assumptions are explicitly documented if rules are unclear.

---

## 14) Style rule
This is a balance lab, not a toy.
Clarity beats cleverness.
Creativity belongs in agent heuristics, not in engine rules.

---

```
## Codex-„Runbook“ (kurz, damit es sofort klappt)

Wenn du Codex fütterst, gib ihm zusätzlich **diesen Auftrag** (als Prompt), damit er nicht anfängt, im Repo herumzuwüten:

* „Create `/sim_py` as specified in `docs/AGENTS.md`. Do not modify existing game rules text. If rules are ambiguous, write assumptions to `/sim_py/docs/ASSUMPTIONS.md`. Ensure determinism tests pass.“

Wenn du willst, schreibe ich dir auch noch eine **separate `docs/TASK_sim_py.md`** (englisch), die Codex Schritt-für-Schritt abarbeitet (Dateiliste + Acceptance Criteria + PR-Checkliste).

[1]: https://github.com/rewired/balance_control.git "GitHub - rewired/balance_control"
```