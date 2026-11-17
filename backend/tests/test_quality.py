"""Matching quality against synthetic ground truth. A regression guard for scoring changes."""

import numpy as np

from pairwise.matching.scoring import build_features, score_matrix
from pairwise.matching.solver import solve_random, solve_rounds
from pairwise.synthetic import generate, true_value


def mean_true_value(people, pairs):
    return np.mean([true_value(people[p.i], people[p.j]) for p in pairs])


def test_beats_random_by_a_wide_margin():
    for seed in range(3):
        people = generate(40, seed=seed)
        s = score_matrix(build_features([p.profile for p in people]))
        ours = mean_true_value(people, solve_rounds(s, 2))
        rand = np.mean([mean_true_value(people, solve_random(s, 2, seed=r)) for r in range(5)])
        assert ours > 1.5 * rand, (seed, ours, rand)
