from __future__ import annotations
from typing import Dict, Any
from .rules_base import RuleBase

class RuleOrder(RuleBase):
    def modify_majority_context(self, ctx: Dict[str, Any]) -> None:
        # Make flipping control slightly harder: defender gets +1 effective influence
        ctx["stickiness"] = ctx.get("stickiness", 0) + 1