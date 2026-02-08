from __future__ import annotations
from typing import Dict, List, Tuple, Set
from .types import GameState, Action

ADJ = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def get_adjacent_positions(occupied: Set[Tuple[int, int]]) -> Set[Tuple[int, int]]:
    res: Set[Tuple[int, int]] = set()
    for (x, y) in occupied:
        for dx, dy in ADJ:
            p = (x + dx, y + dy)
            if p not in occupied:
                res.add(p)
    return res


def get_legal_actions(state: GameState) -> List[Action]:
    actions: List[Action] = []

    # PASS is always legal
    actions.append(Action(type="PASS", aid=0))

    # PLACE_TILE: place next deck tile at any adjacent empty position
    if state.deck.index < len(state.deck.tiles):
        _tile_id, tile_type = state.deck.tiles[state.deck.index]
        occ = set(state.board.pos_index.keys())
        poss = {(0, 0)} if not occ else get_adjacent_positions(occ)
        for pos in sorted(poss):
            actions.append(
                Action(type="PLACE_TILE", aid=0, tile_type=tile_type, placement_ref=pos)
            )

    # PLACE_INFLUENCE: if player has pool > 0
    pl = state.players[state.current_player]
    if pl.influence_pool > 0 and state.board.tiles:
        for tid in sorted(state.board.tiles.keys()):
            actions.append(Action(type="PLACE_INFLUENCE", aid=0, tile_id=tid))

    # MOVE_INFLUENCE: if any influence on any tile; if order is enabled, require a coin
    can_move = True
    if state.expansions.order:
        can_move = state.players[state.current_player].resources.get("coin", 0) > 0
    if can_move:
        for tid, counts in state.board.influence.items():
            if counts[state.current_player] > 0:
                for dest in sorted(state.board.tiles.keys()):
                    if dest == tid:
                        continue
                    actions.append(
                        Action(
                            type="MOVE_INFLUENCE",
                            aid=0,
                            from_tile_id=tid,
                            to_tile_id=dest,
                        )
                    )

    # FORMALIZE_INFLUENCE: always allowed
    actions.append(Action(type="FORMALIZE_INFLUENCE", aid=0))

    # CONVERT_RESOURCES for economy expansion
    if state.expansions.economy:
        if pl.resources.get("labor", 0) > 0:
            actions.append(
                Action(
                    type="CONVERT_RESOURCES",
                    aid=0,
                    conversion={"from": "labor", "to": "coin", "amount": 1},
                )
            )

    from .actions import with_ids

    return with_ids(actions)
