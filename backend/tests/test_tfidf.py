"""Our TF-IDF must match scikit-learn's exactly, so swapping it out changed nothing."""

import numpy as np
import pytest

from pairwise.matching.encoders import TfidfVectorizer, phrase_ngrams
from pairwise.synthetic import generate

sklearn_text = pytest.importorskip("sklearn.feature_extraction.text")


def corpus():
    people = generate(60, seed=5)
    docs = []
    for p in people:
        docs += [p.profile.looking_for, p.profile.can_help_with, p.profile.interests_text]
    return [d for d in docs if d.strip()]


def test_matches_scikit_learn():
    docs = corpus()
    ours = TfidfVectorizer(analyzer=phrase_ngrams).fit(docs)
    ref = sklearn_text.TfidfVectorizer(analyzer=phrase_ngrams, sublinear_tf=True).fit(docs)
    assert list(ours.get_feature_names_out()) == list(ref.get_feature_names_out())
    probe = docs[:20] + ["", "something nobody wrote", "machine learning machine learning"]
    assert np.allclose(ours.transform(probe), ref.transform(probe).toarray())


def test_empty_vocabulary_raises():
    with pytest.raises(ValueError):
        TfidfVectorizer(analyzer=phrase_ngrams).fit(["the and of", ""])
