from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
from .rng import RNG
from .types import GameState, PlayerState, BoardState, DeckState, ExpansionsConfig
from .tiles import build_deck

START_POS = (0, 0)


def new_game_state(seed: int, expansions: ExpansionsConfig, num_players: int = 3) -> Tuple[GameState, RNG]:
    rng = RNG.create(seed)
    deck_list = build_deck(expansions.economy, expansions.order)
    # Deterministic shuffle using RNG
    tiles = list(deck_list)
    rng.shuffle(tiles)

    players: List[PlayerState] = [PlayerState(id=i, influence_pool=8, resources={}) for i in range(num_players)]

    board = BoardState()

    deck = DeckState(tiles=tiles, index=0)

    gs = GameState(
        seed=seed,
        rng_state=rng.getstate(),
        round=1,
        turn=0,
        current_player=0,
        num_players=num_players,
        players=players,
        board=board,
        deck=deck,
        expansions=expansions,
        history=[],
        metrics={
            "blocked_majority_checks_count": 0,
            "brenpunkt_triggered_count": 0,
            "brenpunkt_effective_count": 0,
            "influence_moves_count": 0,
            "pass_count": 0,
            "rounds_played": 0,
            "economy_labor_paid_total": 0,
            "conversion_count": 0,
            "control_changes_total": 0,
            "control_changes_work_tiles": 0,
            "series_influence_on_board_by_player": [],
            "series_resources_sum_by_player": [],
        },
    )

    # Assumption: Start with a CITY tile at origin for connectivity.
    # See docs/ASSUMPTIONS.md.
    if deck.index < len(deck.tiles):
        # Ensure there is at least one CITY to start; if not, just use first tile.
        start_idx = 0
        for i, (tid, ttype) in enumerate(deck.tiles):
            if ttype == "CITY":
                start_idx = i
                break
        tid, ttype = deck.tiles.pop(start_idx)
        deck.tiles.insert(0, (tid, ttype))
        deck.index = 1
        board.tiles[tid] = __tile(tid, ttype, START_POS[0], START_POS[1])
        board.pos_index[START_POS] = tid
        board.influence[tid] = [0 for _ in range(num_players)]
        board.control[tid] = None

    return gs, rng


def __tile(tid: str, ttype: str, x: int, y: int):
    from .types import TileOnBoard

    return TileOnBoard(id=tid, type=ttype, x=x, y=y, orientation=0)
