# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.sim.runner import run_one_game
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig
from sim_py.agents.random_legal import RandomLegalAgent


def test_series_lengths_match_rounds():
    agents = [RandomLegalAgent(), RandomLegalAgent(), RandomLegalAgent()]
    rs = RuleSet.from_config(ExpansionsConfig(economy=True, order=True))
    max_rounds = 7
    state, metrics = run_one_game(rs, agents, seed=123, max_rounds=max_rounds)

    series1 = state.metrics.get("series_influence_on_board_by_player")
    series2 = state.metrics.get("series_resources_sum_by_player")

    assert isinstance(series1, list) and isinstance(series2, list)
    assert state.metrics.get("rounds_played") == max_rounds
    assert len(series1) == max_rounds
    assert len(series2) == max_rounds

    # Each entry should have a value per player
    for row in series1:
        assert isinstance(row, list) and len(row) == state.num_players
    for row in series2:
        assert isinstance(row, list) and len(row) == state.num_players
