from __future__ import annotations
from typing import List, Dict, Any, Tuple
from ..engine.ruleset import RuleSet
from .runner import run_one_game


def run_tournament(ruleset: RuleSet, agent_factories: List[object], seeds: List[int]) -> Dict[str, Any]:
    results = []
    n = len(agent_factories)
    for i, seed in enumerate(seeds):
        # Seat rotation
        agents = [agent_factories[(j + i) % n] for j in range(n)]
        state, metrics = run_one_game(ruleset, agents, seed)
        results.append({"seed": seed, **metrics})
    return {"games": results}