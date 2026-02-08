# importfix
import sys, pathlib as _p
sys.path.insert(0, str(_p.Path(__file__).resolve().parents[2]))

from sim_py.engine.state import new_game_state
from sim_py.engine.ruleset import RuleSet
from sim_py.engine.types import ExpansionsConfig
from sim_py.engine.legal import get_legal_actions
from sim_py.engine.apply import apply_action


def test_order_moves_cost_coin():
    rs = RuleSet.from_config(ExpansionsConfig(order=True))
    state, _ = new_game_state(9, rs.expansions)
    # Seed resources: give player 0 one coin and one influence on start tile
    pid = 0
    tid = next(iter(state.board.tiles.keys()))
    state.board.influence[tid][pid] = 1
    state.players[pid].resources["coin"] = 1
    # Add another destination tile to move to
    # Simulate by adding a CITY tile adjacent and ensure influence vector exists
    from sim_py.engine.types import TileOnBoard
    dest_tid = "T9999"
    state.board.tiles[dest_tid] = TileOnBoard(id=dest_tid, type="CITY", x=1, y=0, orientation=0)
    state.board.influence[dest_tid] = [0 for _ in range(state.num_players)]
    # Generate legal actions and pick a MOVE
    moves = [a for a in get_legal_actions(state) if a.type == "MOVE_INFLUENCE"]
    assert moves, "move should be legal when coin is available"
    before = state.players[pid].resources.get("coin", 0)
    apply_action(state, moves[0])
    after = state.players[pid].resources.get("coin", 0)
    assert before - after == 1


def test_order_blocks_move_without_coin():
    rs = RuleSet.from_config(ExpansionsConfig(order=True))
    state, _ = new_game_state(10, rs.expansions)
    pid = 0
    tid = next(iter(state.board.tiles.keys()))
    state.board.influence[tid][pid] = 1
    state.players[pid].resources["coin"] = 0
    # Add a destination tile
    from sim_py.engine.types import TileOnBoard
    dest_tid = "T9998"
    state.board.tiles[dest_tid] = TileOnBoard(id=dest_tid, type="CITY", x=-1, y=0, orientation=0)
    state.board.influence[dest_tid] = [0 for _ in range(state.num_players)]
    # MOVE should not appear in legal actions when coin == 0
    moves = [a for a in get_legal_actions(state) if a.type == "MOVE_INFLUENCE"]
    assert not moves
