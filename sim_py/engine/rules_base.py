from __future__ import annotations
from typing import Any, Dict
from .types import GameState, Action

class RuleBase:
    def on_turn_start(self, state: GameState) -> None:
        pass

    def on_action_applied(self, state: GameState, action: Action) -> None:
        pass

    def on_round_end(self, state: GameState) -> None:
        pass

    def modify_majority_context(self, ctx: Dict[str, Any]) -> None:
        # ctx: {"stickiness": int}
        pass