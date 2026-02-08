# BALANCE // CONTROL — Python Simulation & LLM Tournaments

This repository hosts the BALANCE // CONTROL ruleset and a deterministic Python simulation engine for balance testing and LLM-vs-LLM tournaments.

- Engine: `sim_py/engine`
- Agents: `sim_py/agents` (deterministic baselines + LLM adapter stub)
- Harness: `sim_py/sim` (runner, tournament, metrics, CLI)
- Docs: `docs/`, extra sim docs in `sim_py/docs/`
- Tests: `tests/` (pytest)

## Requirements
- Python 3.11+
- Optional: `pytest` for tests

## Quickstart
- Run tests: `pytest -q`
- Run one game: `python -m sim_py.sim.cli --games 1 --seeds 123`
- Run tournament (1,000 games, both expansions): `python -m sim_py.sim.cli --games 1000 --exp1 --exp2 --seeds 1 2 3 4 5`

Notes:
- The engine is fully deterministic: same seed + same agents + same ruleset → identical outcomes.
- CLI supports expansion toggles via `--exp1` (Economy & Work) and `--exp2` (Safety & Order).

## Outputs & Metrics
- Per-game metrics include: `winner`, `rounds_played`, `final_influence_on_board_by_player`, `formalizations_by_player`, `blocked_majority_checks_count`, `brenpunkt_*`, `influence_moves_count`, `pass_count`, and `stagnation_turns`.
- See `sim_py/docs/METRICS.md` for details.

## Assumptions
Where the rules texts were ambiguous, explicit assumptions are recorded in `sim_py/docs/ASSUMPTIONS.md`. Engine rules are otherwise derived from the docs without modification.

## Project Layout
- `sim_py/engine`: RNG, types/state, tiles, legal/action application, resolver, scoring, ruleset + expansions
- `sim_py/agents`: `random_legal.py`, `heuristic_*`, `llm_agent.py` (stub)
- `sim_py/sim`: `runner.py`, `tournament.py`, `metrics.py`, `export.py`, `cli.py`
- `sim_py/docs`: `ASSUMPTIONS.md`, `METRICS.md`
- `tests`: determinism, legal actions, resolver, smoke

## Development
- Keep randomness seeded via the engine RNG.
- Engine modules must not import LLM SDKs.
- Prefer clarity over cleverness; add new assumptions to `sim_py/docs/ASSUMPTIONS.md` when needed.
