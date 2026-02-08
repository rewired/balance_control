from __future__ import annotations
from typing import Dict, Any, List
from ..engine.types import GameState


def extract_metrics(state: GameState) -> Dict[str, Any]:
    m = dict(state.metrics)
    # Per-player summaries
    m.update({
        "formalizations_by_player": [p.formalizations for p in state.players],
        "final_influence_on_board_by_player": [sum(c[i] for c in state.board.influence.values()) for i in range(state.num_players)],
    })
    return m
