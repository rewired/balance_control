from __future__ import annotations
from typing import List
from ..engine.types import Action, GameState

class HeuristicInstitutionAgent:
    def choose_action(self, state: GameState, legal_actions: List[Action]) -> Action:
        # Prefer FORMALIZE, then PLACE_INFLUENCE, else fallback
        for t in ("FORMALIZE_INFLUENCE", "PLACE_INFLUENCE", "PLACE_TILE"):
            for a in legal_actions:
                if a.type == t:
                    return a
        return sorted(legal_actions, key=lambda a: a.aid)[0]