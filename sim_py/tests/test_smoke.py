# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.sim.runner import run_one_game
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig
from sim_py.agents.random_legal import RandomLegalAgent


def test_many_games_complete():
    agents = [RandomLegalAgent(), RandomLegalAgent(), RandomLegalAgent()]
    rs = RuleSet.from_config(ExpansionsConfig())
    for seed in range(100):
        state, metrics = run_one_game(rs, agents, seed)
        assert metrics["rounds_played"] > 0
