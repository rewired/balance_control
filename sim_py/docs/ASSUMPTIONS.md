# Assumptions for Python Simulation

- Start tile: Place one `CITY` at `(0,0)` during setup to ensure adjacency space exists.
- Deck composition: Simple counts per `docs/AGENTS.md` guidance (BASE 10 CITY, EXP1 6 WORK, EXP2 4 ORDER). No special tiles.
- One action per player per turn; fixed number of rounds (default 5) ends the game regardless of deck.
- Formalization: When `FORMALIZE_INFLUENCE` is taken, resolver runs for all tiles. Ties remain blocked (no control change) and increment a counter.
- Economy (Exp1): Each controlled `WORK` tile pays +1 `labor` at end of round. Conversion `labor -> coin` is 1:1 when chosen.
- Order (Exp2): Moving influence costs 1 `coin`. Majority stickiness modeled as a +1 bonus to the current controller in resolver context.
- Scoring: Winner is player with most controlled tiles; ties break by lower player index.
- LLM agent: stub only; deterministic fallback to first legal action.- Brennpunkt: Modeled as the per-tile majority check during `FORMALIZE_INFLUENCE`. Each check counts as `brenpunkt_triggered_count`; checks that yield a clear controller (non-tie) count as `brenpunkt_effective_count`.
