# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.engine.state import new_game_state
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig
from sim_py.engine.resolver import resolve_control_for_tile


def test_tie_blocks_control():
    rs = RuleSet.from_config(ExpansionsConfig())
    state, _ = new_game_state(1, rs.expansions)
    tid = next(iter(state.board.tiles.keys()))
    state.board.influence[tid][0] = 1
    state.board.influence[tid][1] = 1
    ctrl = resolve_control_for_tile(state, tid, stickiness=0)
    assert ctrl is None


def test_simple_majority():
    rs = RuleSet.from_config(ExpansionsConfig())
    state, _ = new_game_state(2, rs.expansions)
    tid = next(iter(state.board.tiles.keys()))
    state.board.influence[tid][0] = 2
    state.board.influence[tid][1] = 1
    ctrl = resolve_control_for_tile(state, tid, stickiness=0)
    assert ctrl == 0
