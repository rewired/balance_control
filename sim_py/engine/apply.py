from __future__ import annotations
from typing import Tuple
from .types import GameState, Action
from .errors import IllegalActionError
from .legal import get_legal_actions
from .resolver import resolve_control_for_tile
from .ruleset import RuleSet


def apply_action(state: GameState, action: Action) -> GameState:
    legal = get_legal_actions(state)
    legal_ids = {a.aid for a in legal}
    if action.aid not in legal_ids:
        raise IllegalActionError(f"Illegal action: {action}")

    if action.type == "PASS":
        state.metrics["pass_count"] += 1

    elif action.type == "PLACE_TILE":
        # Place the next tile from the deck at the requested position
        if state.deck.index >= len(state.deck.tiles):
            raise IllegalActionError("No tiles left to place")
        tid, ttype = state.deck.tiles[state.deck.index]
        pos = action.placement_ref
        if pos is None:
            raise IllegalActionError("placement_ref required")
        if pos in state.board.pos_index:
            raise IllegalActionError("Position occupied")
        state.board.tiles[tid] = __tile(tid, ttype, pos[0], pos[1])
        state.board.pos_index[pos] = tid
        state.board.influence[tid] = [0 for _ in range(state.num_players)]
        state.board.control[tid] = None
        state.deck.index += 1

    elif action.type == "PLACE_INFLUENCE":
        if not action.tile_id:
            raise IllegalActionError("tile_id required")
        pid = state.current_player
        if state.players[pid].influence_pool <= 0:
            raise IllegalActionError("no influence available")
        counts = state.board.influence.get(action.tile_id)
        if counts is None:
            raise IllegalActionError("unknown tile")
        counts[pid] += 1
        state.players[pid].influence_pool -= 1

    elif action.type == "MOVE_INFLUENCE":
        if not action.from_tile_id or not action.to_tile_id:
            raise IllegalActionError("from/to required")
        pid = state.current_player
        src = state.board.influence.get(action.from_tile_id)
        dst = state.board.influence.get(action.to_tile_id)
        if src is None or dst is None:
            raise IllegalActionError("unknown tile")
        if src[pid] <= 0:
            raise IllegalActionError("no influence on source")
        # Expansion 2: additional movement cost of 1 coin if available, else illegal
        if state.expansions.order:
            coins = state.players[pid].resources.get("coin", 0)
            if coins <= 0:
                raise IllegalActionError("order cost: 1 coin required to move influence")
            state.players[pid].resources["coin"] = coins - 1
        src[pid] -= 1
        dst[pid] += 1
        state.metrics["influence_moves_count"] += 1

    elif action.type == "FORMALIZE_INFLUENCE":
        # Run resolver on all tiles, allowing rules to modify context
        ctx = {"stickiness": 0}
        rs = RuleSet.from_config(state.expansions)
        rs.modify_majority_context(ctx)
        prev_ctrl = dict(state.board.control)
        for tid in list(state.board.tiles.keys()):
            # brenpunkt: each tile check is a trigger; effective if not a tie
            state.metrics["brenpunkt_triggered_count"] = state.metrics.get("brenpunkt_triggered_count", 0) + 1
            new_ctrl = resolve_control_for_tile(state, tid, stickiness=ctx.get("stickiness", 0))
            if new_ctrl is None:
                state.metrics["blocked_majority_checks_count"] += 1
            else:
                state.metrics["brenpunkt_effective_count"] = state.metrics.get("brenpunkt_effective_count", 0) + 1
            if prev_ctrl.get(tid) != new_ctrl:
                state.metrics["control_changes_total"] = state.metrics.get("control_changes_total", 0) + 1
                ttype = state.board.tiles[tid].type
                if ttype == "WORK":
                    state.metrics["control_changes_work_tiles"] = state.metrics.get("control_changes_work_tiles", 0) + 1
            state.board.control[tid] = new_ctrl
        pid = state.current_player
        state.players[pid].formalizations += 1

    elif action.type == "CONVERT_RESOURCES":
        conv = action.conversion or {}
        src = conv.get("from")
        dst = conv.get("to")
        amt = int(conv.get("amount", 1))
        pid = state.current_player
        have = state.players[pid].resources.get(src, 0)
        if amt <= 0 or have < amt:
            raise IllegalActionError("invalid conversion amount")
        state.players[pid].resources[src] = have - amt
        state.players[pid].resources[dst] = state.players[pid].resources.get(dst, 0) + amt
        state.metrics["conversion_count"] = state.metrics.get("conversion_count", 0) + 1

    else:
        raise IllegalActionError(f"Unknown action type: {action.type}")

    # Common: advance turn
    state.turn += 1
    state.current_player = (state.current_player + 1) % state.num_players

    return state


def __tile(tid: str, ttype: str, x: int, y: int):
    from .types import TileOnBoard

    return TileOnBoard(id=tid, type=ttype, x=x, y=y, orientation=0)
