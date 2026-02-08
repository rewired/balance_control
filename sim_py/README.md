# sim_py — BALANCE // CONTROL

This directory contains the self-contained Python simulation engine, agents, and CLI harness.

- Engine: `engine/`
- Agents: `agents/`
- Sim harness: `sim/`
- Tests: `tests/`
- Docs: `docs/`

## Quickstart (from repo root)
- `python -m pip install -e .[test]`
- `pytest -q`
- `python -m sim_py.sim.cli --games 1 --seeds 123`

## Packaging (local)
This folder also includes a `pyproject.toml` so it can be packaged independently if needed:
- `cd sim_py && python -m pip install -e .`

See `../README.md` for more details and venv setup.
