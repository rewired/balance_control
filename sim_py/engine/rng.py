from __future__ import annotations
import random
from dataclasses import dataclass
from typing import Any, Iterable, List, Sequence, Tuple, TypeVar

T = TypeVar("T")

@dataclass
class RNG:
    seed: int
    _rng: random.Random

    @classmethod
    def create(cls, seed: int) -> "RNG":
        r = random.Random(seed)
        return cls(seed=seed, _rng=r)

    def getstate(self) -> Tuple[Any, ...]:
        return self._rng.getstate()

    def setstate(self, state: Tuple[Any, ...]) -> None:
        self._rng.setstate(state)

    def randint(self, a: int, b: int) -> int:
        return self._rng.randint(a, b)

    def choice(self, seq: Sequence[T]) -> T:
        if not seq:
            raise ValueError("choice from empty sequence")
        return self._rng.choice(list(seq))

    def shuffle(self, x: List[T]) -> None:
        self._rng.shuffle(x)

    def random(self) -> float:
        return self._rng.random()

    def sample(self, population: Sequence[T], k: int) -> List[T]:
        return self._rng.sample(list(population), k)