from __future__ import annotations
from typing import List
from ..engine.types import Action, GameState

class HeuristicProductionAgent:
    def choose_action(self, state: GameState, legal_actions: List[Action]) -> Action:
        # Prefer placing influence to secure WORK tiles, then convert resources
        for a in legal_actions:
            if a.type == "PLACE_INFLUENCE":
                return a
        for a in legal_actions:
            if a.type == "CONVERT_RESOURCES":
                return a
        return sorted(legal_actions, key=lambda a: a.aid)[0]