from __future__ import annotations
from typing import Dict, List, Tuple
from .types import Action

AID_START = 1000


def with_ids(actions: List[Action]) -> List[Action]:
    for i, a in enumerate(actions, start=AID_START):
        a.aid = i
    # Deterministic sort for stability
    actions.sort(key=lambda a: (a.type, a.tile_id or "", a.tile_type or "", a.placement_ref or (0, 0), a.from_tile_id or "", a.to_tile_id or "", a.aid))
    # Re-assign aids post-sort to maintain stable ids
    for i, a in enumerate(actions, start=AID_START):
        a.aid = i
    return actions