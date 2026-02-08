from __future__ import annotations
from typing import Dict, List, Tuple

BASE = ["CITY"] * 10
EXP1 = ["WORK"] * 6
EXP2 = ["ORDER"] * 4


def build_deck(exp_economy: bool, exp_order: bool) -> List[Tuple[str, str]]:
    bag: List[str] = []
    bag.extend(BASE)
    if exp_economy:
        bag.extend(EXP1)
    if exp_order:
        bag.extend(EXP2)
    tiles: List[Tuple[str, str]] = []
    for i, t in enumerate(bag, start=1):
        tiles.append((f"T{i:04d}", t))
    return tiles