from __future__ import annotations
from dataclasses import dataclass
from typing import List
from .rules_base import RuleBase
from .rules_expansion_01_economy import RuleEconomy
from .rules_expansion_02_order import RuleOrder
from .types import ExpansionsConfig

@dataclass
class RuleSet:
    expansions: ExpansionsConfig
    rules: List[RuleBase]

    @classmethod
    def from_config(cls, expansions: ExpansionsConfig) -> "RuleSet":
        rules: List[RuleBase] = [RuleBase()]
        if expansions.economy:
            rules.append(RuleEconomy())
        if expansions.order:
            rules.append(RuleOrder())
        return cls(expansions=expansions, rules=rules)

    def on_turn_start(self, state):
        for r in self.rules:
            r.on_turn_start(state)

    def on_action_applied(self, state, action):
        for r in self.rules:
            r.on_action_applied(state, action)

    def on_round_end(self, state):
        for r in self.rules:
            r.on_round_end(state)

    def modify_majority_context(self, ctx):
        for r in self.rules:
            r.modify_majority_context(ctx)