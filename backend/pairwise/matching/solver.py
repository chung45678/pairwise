"""Assign each attendee up to k distinct matches.

This is maximum-weight b-matching. We solve it as k rounds of maximum-weight
matching (Edmonds' blossom algorithm), removing used edges between rounds, plus a
repair step so nobody is left out when the headcount is odd.

Invariants (enforced by tests):
  * no self-matches and no duplicate pairs
  * everyone gets at least one match when n >= 2
  * nobody gets more than k + 1 matches (the +1 only comes from odd-count repair)

Two baselines live here too so the benchmark can compare against them.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

import networkx as nx
import numpy as np


@dataclass(frozen=True)
class Pair:
    i: int
    j: int
    score: float
    round: int

    @property
    def key(self) -> tuple[int, int]:
        return (self.i, self.j) if self.i < self.j else (self.j, self.i)


def _finite_offset(scores: np.ndarray) -> float:
    finite = scores[np.isfinite(scores)]
    lo = float(finite.min()) if finite.size else 0.0
    # Shift so every weight is >= 1. With non-positive weights blossom would
    # rather skip an edge, which breaks the coverage guarantee.
    return 1.0 - lo if lo < 1.0 else 0.0


def solve_rounds(scores: np.ndarray, k: int) -> list[Pair]:
    """k rounds of max-cardinality max-weight matching with odd-count repair."""
    n = scores.shape[0]
    if n < 2 or k < 1:
        return []

    offset = _finite_offset(scores)
    used: set[tuple[int, int]] = set()
    degree = np.zeros(n, dtype=int)
    pairs: list[Pair] = []

    def take(i: int, j: int, rnd: int) -> None:
        a, b = (i, j) if i < j else (j, i)
        used.add((a, b))
        degree[a] += 1
        degree[b] += 1
        pairs.append(Pair(a, b, float(scores[a, b]), rnd))

    for rnd in range(1, k + 1):
        g = nx.Graph()
        g.add_nodes_from(range(n))
        for i in range(n):
            for j in range(i + 1, n):
                if (i, j) not in used and np.isfinite(scores[i, j]):
                    g.add_edge(i, j, weight=float(scores[i, j]) + offset)

        matched: set[int] = set()
        for i, j in sorted(nx.max_weight_matching(g, maxcardinality=True), key=sorted):
            take(i, j, rnd)
            matched.update((i, j))

        # Repair: anyone who sat out this round (and is behind) joins their best
        # available partner. Partners can only take one extra, which caps degree at k+1.
        left_out = sorted(
            (u for u in range(n) if u not in matched and degree[u] < rnd), key=lambda u: degree[u]
        )
        for u in left_out:
            candidates = [
                v
                for v in range(n)
                if v != u
                and (min(u, v), max(u, v)) not in used
                and degree[v] <= rnd
                and np.isfinite(scores[u, v])
            ]
            if candidates:
                v = max(candidates, key=lambda v: scores[u, v])
                take(u, v, rnd)

    return pairs


def solve_greedy(scores: np.ndarray, k: int) -> list[Pair]:
    """Baseline: take edges best-first while both ends have capacity."""
    n = scores.shape[0]
    edges = sorted(
        (
            (scores[i, j], i, j)
            for i in range(n)
            for j in range(i + 1, n)
            if np.isfinite(scores[i, j])
        ),
        reverse=True,
    )
    degree = np.zeros(n, dtype=int)
    pairs = []
    for s, i, j in edges:
        if degree[i] < k and degree[j] < k:
            degree[i] += 1
            degree[j] += 1
            pairs.append(Pair(i, j, float(s), int(max(degree[i], degree[j]))))
    return pairs


def solve_random(scores: np.ndarray, k: int, seed: int = 0) -> list[Pair]:
    """Baseline: k rounds of random pairing (what an organizer does with a hat)."""
    n = scores.shape[0]
    rng = random.Random(seed)
    used: set[tuple[int, int]] = set()
    pairs = []
    for rnd in range(1, k + 1):
        order = list(range(n))
        rng.shuffle(order)
        pool = order[:]
        while len(pool) >= 2:
            i = pool.pop()
            for idx in range(len(pool) - 1, -1, -1):
                j = pool[idx]
                key = (min(i, j), max(i, j))
                if key not in used:
                    pool.pop(idx)
                    used.add(key)
                    pairs.append(Pair(key[0], key[1], float(scores[key]), rnd))
                    break
    return pairs
