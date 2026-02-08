# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.engine.state import new_game_state
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig


def test_economy_pays_labor_on_work_tiles():
    rs = RuleSet.from_config(ExpansionsConfig(economy=True))
    state, _ = new_game_state(42, rs.expansions)
    # Give player 0 one influence and control on any WORK tile by placing influence and formalizing
    # Ensure a WORK tile exists; if not yet placed, simulate by marking first tile as WORK for test context
    # Instead: directly award control of tiles of type WORK if present
    # Find any tile (start tile may be CITY); emulate a WORK tile by setting its type and control
    tid = next(iter(state.board.tiles.keys()))
    state.board.tiles[tid].type = "WORK"
    state.board.control[tid] = 0
    # End of round should pay +1 labor
    from sim_py.engine.rules_expansion_01_economy import RuleEconomy
    RuleEconomy().on_round_end(state)
    assert state.players[0].resources.get("labor", 0) >= 1
