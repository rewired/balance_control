from __future__ import annotations
from typing import Dict, Optional
from .types import GameState


def resolve_control_for_tile(state: GameState, tile_id: str, *, stickiness: int = 0) -> Optional[int]:
    counts = state.board.influence.get(tile_id, [])
    if not counts:
        return None
    # Add stickiness bonus to current controller (defender)
    defender = state.board.control.get(tile_id)
    adjusted = list(counts)
    if defender is not None and 0 <= defender < len(adjusted):
        adjusted[defender] += stickiness
    # Determine majority
    best = max(adjusted)
    winners = [i for i, v in enumerate(adjusted) if v == best]
    if len(winners) != 1:
        return None
    return winners[0]