from __future__ import annotations
import argparse
from typing import List
from ..engine.ruleset import RuleSet
from ..engine.types import ExpansionsConfig
from ..agents.random_legal import RandomLegalAgent
from .runner import run_one_game
from .tournament import run_tournament
from .export import export_json, export_csv


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser("balance-control-sim")
    p.add_argument("--games", type=int, default=1)
    p.add_argument("--seeds", type=int, nargs="*", default=[42])
    p.add_argument("--exp1", action="store_true")
    p.add_argument("--exp2", action="store_true")
    p.add_argument("--json-out", type=str, default=None, help="Write results to JSON path")
    p.add_argument("--csv-out", type=str, default=None, help="Write results to CSV path (tournament only)")
    args = p.parse_args(argv)

    ruleset = RuleSet.from_config(ExpansionsConfig(economy=args.exp1, order=args.exp2))

    agents = [RandomLegalAgent(), RandomLegalAgent(), RandomLegalAgent()]

    if args.games == 1:
        state, metrics = run_one_game(ruleset, agents, args.seeds[0])
        if args.json_out:
            export_json(args.json_out, metrics)
        print(metrics)
    else:
        seeds = args.seeds if args.seeds else list(range(args.games))
        res = run_tournament(ruleset, agents, seeds)
        if args.json_out:
            export_json(args.json_out, res)
        if args.csv_out:
            # Flatten per-game rows for CSV
            rows = res.get("games", [])
            export_csv(args.csv_out, rows)
        print(res)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
