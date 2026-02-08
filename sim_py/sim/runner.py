from __future__ import annotations
from typing import List, Tuple
from ..engine.state import new_game_state
from ..engine.legal import get_legal_actions
from ..engine.apply import apply_action
from ..engine.ruleset import RuleSet
from ..engine.types import ExpansionsConfig, GameState
from ..engine.scoring import score_game, winner_from_scores
from .metrics import extract_metrics


def _sum_resources_by_player(state: GameState) -> List[int]:
    sums = []
    for p in state.players:
        sums.append(sum(p.resources.values()))
    return sums


def _influence_on_board_by_player(state: GameState) -> List[int]:
    totals = [0 for _ in range(state.num_players)]
    for counts in state.board.influence.values():
        for i, v in enumerate(counts):
            totals[i] += v
    return totals


def run_one_game(ruleset: RuleSet, agents: List[object], seed: int, max_rounds: int = 5) -> Tuple[GameState, dict]:
    expansions = ruleset.expansions
    state, rng = new_game_state(seed, expansions, num_players=len(agents))
    # Game loop: fixed number of rounds, one action per player per turn
    for r in range(1, max_rounds + 1):
        state.round = r
        for seat, agent in enumerate(agents):
            state.current_player = seat
            ruleset.on_turn_start(state)
            legal = get_legal_actions(state)
            action = agent.choose_action(state, legal)
            state = apply_action(state, action)
            ruleset.on_action_applied(state, action)
        ruleset.on_round_end(state)
        # Per-round time series
        state.metrics.setdefault("series_influence_on_board_by_player", []).append(_influence_on_board_by_player(state))
        state.metrics.setdefault("series_resources_sum_by_player", []).append(_sum_resources_by_player(state))
    state.metrics["rounds_played"] = max_rounds
    scores = score_game(state)
    state.metrics["winner"] = winner_from_scores(scores)
    return state, extract_metrics(state)
