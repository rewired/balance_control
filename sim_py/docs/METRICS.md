# Metrics

Minimum emitted per game:
- `winner`
- `rounds_played`
- `final_influence_on_board_by_player`
- `formalizations_by_player`
- `blocked_majority_checks_count`
- `brenpunkt_triggered_count`
- `brenpunkt_effective_count`
- `influence_moves_count`
- `pass_count`
- `stagnation_turns` (defined as count of PASS actions)
- `brenpunkt_triggered_count`: number of tile-level majority checks performed during formalization.
- `brenpunkt_effective_count`: number of those checks that were non-ties (i.e., a controller exists).
- `economy_labor_paid_total`: total number of labor units paid by WORK tiles across the game.
- `conversion_count`: number of resource conversion actions applied.
- `control_changes_total`: number of times tile control changed during formalizations (including None→player and player→player).
- `control_changes_work_tiles`: subset of control changes that occurred on WORK tiles.
- `series_influence_on_board_by_player`: list (per round) of influence totals per player.
- `series_resources_sum_by_player`: list (per round) of per-player resource sums.
