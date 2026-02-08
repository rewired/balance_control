# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.sim.runner import run_one_game
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig
from sim_py.engine.types import state_fingerprint
from sim_py.agents.random_legal import RandomLegalAgent

AGENTS = [RandomLegalAgent(), RandomLegalAgent(), RandomLegalAgent()]


def run_with(seed, exp1=False, exp2=False):
    rs = RuleSet.from_config(ExpansionsConfig(economy=exp1, order=exp2))
    s1, _ = run_one_game(rs, AGENTS, seed)
    s2, _ = run_one_game(rs, AGENTS, seed)
    return state_fingerprint(s1), state_fingerprint(s2)


def test_determinism_base():
    a, b = run_with(123, False, False)
    assert a == b


def test_determinism_exp1():
    a, b = run_with(123, True, False)
    assert a == b


def test_determinism_exp2():
    a, b = run_with(123, False, True)
    assert a == b


def test_determinism_both():
    a, b = run_with(123, True, True)
    assert a == b
