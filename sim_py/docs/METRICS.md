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
