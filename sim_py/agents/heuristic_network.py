from __future__ import annotations
from typing import List
from ..engine.types import Action, GameState

class HeuristicNetworkAgent:
    def choose_action(self, state: GameState, legal_actions: List[Action]) -> Action:
        # Prefer MOVE to create ties, then PLACE_TILE, else fallback
        for t in ("MOVE_INFLUENCE", "PLACE_TILE"):
            for a in legal_actions:
                if a.type == t:
                    return a
        return sorted(legal_actions, key=lambda a: a.aid)[0]