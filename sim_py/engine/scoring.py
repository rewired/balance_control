from __future__ import annotations
from typing import Dict
from .types import GameState


def score_game(state: GameState) -> Dict[int, int]:
    # Score by number of controlled tiles
    scores: Dict[int, int] = {i: 0 for i in range(state.num_players)}
    for tid, ctrl in state.board.control.items():
        if ctrl is not None:
            scores[ctrl] += 1
    return scores


def winner_from_scores(scores: Dict[int, int]) -> int:
    # Tie-breaker: lowest player id wins ties
    best_score = max(scores.values())
    winners = [pid for pid, s in scores.items() if s == best_score]
    return min(winners)