"""Pair scoring: how valuable is it for attendee i to meet attendee j?

See docs/DESIGN.md §4.2 for the formula and why complementarity has the highest weight.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from pairwise.matching.encoders import TextEncoder, TfidfEncoder
from pairwise.matching.profile import Profile


@dataclass(frozen=True)
class ScoringWeights:
    complement: float = 0.55
    shared: float = 0.35
    diversity: float = 0.10
    same_affiliation_penalty: float = 0.50


@dataclass
class PairFeatures:
    """All pairwise signals for one event. Every matrix is n x n."""

    profiles: list[Profile]
    looking: np.ndarray  # n x d vectors (kept for explanations)
    helping: np.ndarray
    interest_vecs: np.ndarray
    help: np.ndarray  # help[i, j] = how well j's can_help_with covers i's looking_for
    complement: np.ndarray  # symmetric: mean of help in both directions
    shared: np.ndarray
    diversity: np.ndarray
    same_affiliation: np.ndarray

    @property
    def n(self) -> int:
        return len(self.profiles)


def _jaccard_matrix(profiles: Sequence[Profile]) -> np.ndarray:
    n = len(profiles)
    sets = [p.tag_set for p in profiles]
    out = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            union = sets[i] | sets[j]
            if union:
                out[i, j] = out[j, i] = len(sets[i] & sets[j]) / len(union)
    return out


def _equal_nonempty(values: Sequence[str]) -> np.ndarray:
    norm = [v.strip().lower() for v in values]
    n = len(norm)
    out = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            if norm[i] and norm[i] == norm[j]:
                out[i, j] = out[j, i] = 1.0
    return out


def build_features(profiles: Sequence[Profile], encoder: TextEncoder | None = None) -> PairFeatures:
    profiles = list(profiles)
    encoder = encoder or TfidfEncoder()

    looking_docs = [p.looking_for for p in profiles]
    helping_docs = [p.can_help_with for p in profiles]
    interest_docs = [p.interests_text for p in profiles]
    encoder.fit(looking_docs + helping_docs + interest_docs)

    looking = encoder.transform(looking_docs)
    helping = encoder.transform(helping_docs)
    interest_vecs = encoder.transform(interest_docs)

    help_ = looking @ helping.T
    complement = (help_ + help_.T) / 2
    shared = 0.5 * _jaccard_matrix(profiles) + 0.5 * (interest_vecs @ interest_vecs.T)

    roles = [p.role for p in profiles]
    has_role = np.array([bool(r.strip()) for r in roles])
    diversity = (1.0 - _equal_nonempty(roles)) * np.outer(has_role, has_role)

    same_aff = _equal_nonempty([p.affiliation for p in profiles])

    for m in (help_, complement, shared, diversity):
        np.fill_diagonal(m, 0.0)

    return PairFeatures(
        profiles=profiles,
        looking=looking,
        helping=helping,
        interest_vecs=interest_vecs,
        help=help_,
        complement=complement,
        shared=shared,
        diversity=diversity,
        same_affiliation=same_aff,
    )


def score_matrix(features: PairFeatures, weights: ScoringWeights | None = None) -> np.ndarray:
    """Symmetric n x n score matrix with -inf on the diagonal."""
    w = weights or ScoringWeights()
    s = (
        w.complement * features.complement
        + w.shared * features.shared
        + w.diversity * features.diversity
        - w.same_affiliation_penalty * features.same_affiliation
    )
    s = (s + s.T) / 2  # guard against float asymmetry
    np.fill_diagonal(s, -np.inf)
    return s
