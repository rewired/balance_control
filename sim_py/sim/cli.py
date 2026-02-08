from __future__ import annotations
import argparse
from typing import List
from ..engine.ruleset import RuleSet
from ..engine.types import ExpansionsConfig
from ..agents.random_legal import RandomLegalAgent
from .runner import run_one_game
from .tournament import run_tournament


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser("balance-control-sim")
    p.add_argument("--games", type=int, default=1)
    p.add_argument("--seeds", type=int, nargs="*", default=[42])
    p.add_argument("--exp1", action="store_true")
    p.add_argument("--exp2", action="store_true")
    args = p.parse_args(argv)

    ruleset = RuleSet.from_config(ExpansionsConfig(economy=args.exp1, order=args.exp2))

    agents = [RandomLegalAgent(), RandomLegalAgent(), RandomLegalAgent()]

    if args.games == 1:
        state, metrics = run_one_game(ruleset, agents, args.seeds[0])
        print(metrics)
    else:
        seeds = args.seeds if args.seeds else list(range(args.games))
        res = run_tournament(ruleset, agents, seeds)
        print(res)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())