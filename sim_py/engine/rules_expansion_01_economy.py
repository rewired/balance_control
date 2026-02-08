from __future__ import annotations
from .rules_base import RuleBase
from .types import GameState

class RuleEconomy(RuleBase):
    def on_round_end(self, state: GameState) -> None:
        # Each controlled WORK tile pays +1 labor
        for tile_id, ctrl in state.board.control.items():
            if ctrl is not None:
                tile = state.board.tiles[tile_id]
                if tile.type == "WORK":
                    state.players[ctrl].resources["labor"] = state.players[ctrl].resources.get("labor", 0) + 1