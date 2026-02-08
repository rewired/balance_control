from __future__ import annotations
from typing import List
from ..engine.types import Action, GameState

class LLMAgent:
    def __init__(self, call_llm=None):
        self.call_llm = call_llm

    def choose_action(self, state: GameState, legal_actions: List[Action]) -> Action:
        # Placeholder: deterministic fallback
        return sorted(legal_actions, key=lambda a: a.aid)[0]