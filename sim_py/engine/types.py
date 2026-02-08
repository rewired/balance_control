from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Any, Literal
import json
import hashlib

ActionType = Literal[
    "PLACE_TILE",
    "PLACE_INFLUENCE",
    "MOVE_INFLUENCE",
    "FORMALIZE_INFLUENCE",
    "CONVERT_RESOURCES",
    "PASS",
]

@dataclass
class Action:
    type: ActionType
    aid: int
    tile_type: Optional[str] = None
    placement_ref: Optional[Tuple[int, int]] = None
    orientation: Optional[int] = None
    tile_id: Optional[str] = None
    from_tile_id: Optional[str] = None
    to_tile_id: Optional[str] = None
    conversion: Optional[Dict[str, Any]] = None

@dataclass
class PlayerState:
    id: int
    influence_pool: int = 8
    resources: Dict[str, int] = field(default_factory=dict)
    formalizations: int = 0

@dataclass
class TileOnBoard:
    id: str
    type: str
    x: int
    y: int
    orientation: int = 0

@dataclass
class BoardState:
    tiles: Dict[str, TileOnBoard] = field(default_factory=dict)
    pos_index: Dict[Tuple[int, int], str] = field(default_factory=dict)
    influence: Dict[str, List[int]] = field(default_factory=dict)  # tile_id -> counts per player
    control: Dict[str, Optional[int]] = field(default_factory=dict)

@dataclass
class DeckState:
    tiles: List[Tuple[str, str]] = field(default_factory=list)  # list of (tile_id, tile_type)
    index: int = 0

@dataclass
class ExpansionsConfig:
    economy: bool = False
    order: bool = False

@dataclass
class GameState:
    seed: int
    rng_state: Optional[Tuple[Any, ...]]
    round: int
    turn: int
    current_player: int
    num_players: int
    players: List[PlayerState]
    board: BoardState
    deck: DeckState
    expansions: ExpansionsConfig
    history: List[Dict[str, Any]] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_public_dict(self) -> Dict[str, Any]:
        # Exclude Python RNG internal tuple; keep seed only.
        d = asdict(self)
        d.pop("rng_state", None)
        # Normalize BoardState.pos_index keys (tuples) -> 'x,y' strings for JSON stability
        board = d.get("board", {})
        pos = board.get("pos_index")
        if isinstance(pos, dict):
            new_pos = {}
            for k, v in pos.items():
                if isinstance(k, (list, tuple)) and len(k) == 2:
                    new_pos[f"{k[0]},{k[1]}"] = v
                else:
                    new_pos[str(k)] = v
            board["pos_index"] = new_pos
        d["board"] = board
        return d


def state_fingerprint(state: GameState) -> str:
    # Stable hash of the public state for determinism checks.
    data = state.to_public_dict()
    encoded = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
