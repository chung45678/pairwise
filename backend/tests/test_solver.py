"""Solver invariants, checked across many random sizes and seeds."""

from collections import Counter

import numpy as np
import pytest

from pairwise.matching.solver import solve_greedy, solve_random, solve_rounds


def random_scores(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    m = rng.normal(0.2, 0.3, size=(n, n))  # includes negative scores on purpose
    m = (m + m.T) / 2
    np.fill_diagonal(m, -np.inf)
    return m


def check_invariants(pairs, n: int, k: int):
    keys = [p.key for p in pairs]
    assert all(i != j for i, j in keys), "self-match"
    assert len(keys) == len(set(keys)), "duplicate pair"
    degree = Counter()
    for i, j in keys:
        degree[i] += 1
        degree[j] += 1
    assert set(degree) == set(range(n)), f"someone was left out: {set(range(n)) - set(degree)}"
    assert max(degree.values()) <= k + 1, "capacity exceeded"
    return degree


@pytest.mark.parametrize("n", list(range(2, 25)) + [37, 60])
@pytest.mark.parametrize("k", [1, 2, 3])
def test_rounds_invariants(n, k):
    for seed in range(3):
        pairs = solve_rounds(random_scores(n, seed), k)
        degree = check_invariants(pairs, n, k)
        # With enough people, everyone gets at least k matches.
        if n > k + 1:
            assert min(degree.values()) >= k


def test_even_count_has_no_extras():
    pairs = solve_rounds(random_scores(20, 1), 2)
    degree = Counter(x for p in pairs for x in p.key)
    assert set(degree.values()) == {2}


def test_round_one_is_optimal_matching():
    # Two obvious couples: (0,1) and (2,3). Cross pairs are bad.
    s = np.full((4, 4), 0.0)
    s[0, 1] = s[1, 0] = 0.9
    s[2, 3] = s[3, 2] = 0.8
    np.fill_diagonal(s, -np.inf)
    r1 = {p.key for p in solve_rounds(s, 1)}
    assert r1 == {(0, 1), (2, 3)}


def test_rounds_beats_greedy_on_coverage_trap():
    # Greedy grabs the single best edge (0,1) and strands 2 and 3 with each other,
    # which is fine here, but with k=1 and a "popular" node greedy leaves someone out.
    s = np.array(
        [
            [-np.inf, 0.9, 0.8, 0.0],
            [0.9, -np.inf, 0.0, -1.0],
            [0.8, 0.0, -np.inf, -1.0],
            [0.0, -1.0, -1.0, -np.inf],
        ]
    )
    rounds = solve_rounds(s, 1)
    covered = {x for p in rounds for x in p.key}
    assert covered == {0, 1, 2, 3}


def test_too_small():
    assert solve_rounds(np.full((1, 1), -np.inf), 2) == []
    assert solve_rounds(random_scores(5, 0), 0) == []


def test_two_people_many_rounds():
    pairs = solve_rounds(random_scores(2, 0), 3)
    assert [p.key for p in pairs] == [(0, 1)]


@pytest.mark.parametrize("solver", [solve_greedy, solve_random])
def test_baselines_never_duplicate(solver):
    pairs = solver(random_scores(15, 2), 2)
    keys = [p.key for p in pairs]
    assert len(keys) == len(set(keys))
    assert all(i != j for i, j in keys)
