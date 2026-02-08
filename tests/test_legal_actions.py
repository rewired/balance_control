# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[1]))

from sim_py.engine.state import new_game_state
from sim_py.engine.legal import get_legal_actions
from sim_py.engine.apply import apply_action
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig


def test_apply_any_legal_action_is_valid():
    rs = RuleSet.from_config(ExpansionsConfig())
    state, rng = new_game_state(7, rs.expansions)
    legals = get_legal_actions(state)
    assert legals, "should have at least PASS"
    for a in legals:
        # Apply and ensure state advances without exception
        apply_action(state, a)
        assert state.turn >= 0
