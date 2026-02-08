from __future__ import annotations
from typing import List
from ..engine.types import Action, GameState

class RandomLegalAgent:
    def choose_action(self, state: GameState, legal_actions: List[Action]) -> Action:
        # Deterministic: sort by aid; pick via engine RNG (seeded)
        legal = sorted(legal_actions, key=lambda a: a.aid)
        # Use seed-derived pseudo-choice: use turn to index into list mod len
        idx = state.turn % len(legal)
        return legal[idx]