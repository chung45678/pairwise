import numpy as np

from pairwise.matching.encoders import TfidfEncoder
from pairwise.matching.profile import Profile
from pairwise.matching.scoring import ScoringWeights, build_features, score_matrix


def people():
    return [
        Profile(
            1, "Maya", "PM", "UW PM", ("fintech",), "design feedback on mockups", "roadmapping"
        ),
        Profile(
            2,
            "Jordan",
            "Designer",
            "Blueprint",
            ("figma",),
            "learn roadmapping",
            "design feedback, figma",
        ),
        Profile(3, "Sam", "PM", "UW PM", ("fintech",), "learn roadmapping", "roadmapping"),
        Profile(4, "Empty", "", "", (), "", ""),
    ]


def test_matrix_is_symmetric_with_inf_diagonal():
    s = score_matrix(build_features(people()))
    assert np.allclose(np.nan_to_num(s, neginf=0), np.nan_to_num(s.T, neginf=0))
    assert np.all(np.isneginf(np.diag(s)))


def test_complementary_pair_beats_similar_pair():
    s = score_matrix(build_features(people()))
    # Maya<->Jordan help each other. Maya<->Sam are similar and share a club.
    assert s[0, 1] > s[0, 2]


def test_help_is_directional():
    f = build_features(people())
    # Jordan offers design feedback, which Maya wants. Maya doesn't offer it to Jordan.
    assert f.help[0, 1] > 0
    assert f.help[0, 1] != f.help[1, 0] or f.help[0, 1] > 0


def test_same_affiliation_penalty():
    f = build_features(people())
    with_penalty = score_matrix(f)
    without = score_matrix(f, ScoringWeights(same_affiliation_penalty=0))
    assert with_penalty[0, 2] < without[0, 2]
    assert with_penalty[0, 1] == without[0, 1]


def test_empty_profile_scores_are_finite():
    s = score_matrix(build_features(people()))
    assert np.all(np.isfinite(s[3, :3]))


def test_all_empty_text_does_not_crash():
    ps = [Profile(i, f"P{i}") for i in range(4)]
    s = score_matrix(build_features(ps, TfidfEncoder()))
    assert s.shape == (4, 4)


def test_bigrams_never_cross_list_items():
    from pairwise.matching.encoders import phrase_ngrams

    grams = phrase_ngrams("SQL, data analysis and dashboards")
    assert "data analysis" in grams
    assert "sql data" not in grams and "analysis dashboards" not in grams


def test_framing_words_do_not_create_matches():
    # "learning SQL" and "machine learning" share only a framing word.
    a = Profile(1, "A", looking_for="learning SQL")
    b = Profile(2, "B", can_help_with="machine learning")
    f = build_features([a, b])
    assert f.help[0, 1] == 0
