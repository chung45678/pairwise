"""Text encoders: turn free text into vectors in one shared space.

Every field (interests, looking_for, can_help_with) for an event goes through the
same fitted encoder, so "looking_for" of one person and "can_help_with" of another
are directly comparable with a dot product.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence
from typing import Protocol, runtime_checkable

import httpx
import numpy as np

from pairwise.matching.stopwords import ENGLISH_STOP_WORDS

# Words people use to *frame* a request rather than say what it's about. Left in,
# "learning SQL" and "machine learning" would match on "learning".
INTAKE_STOP_WORDS = frozenset(
    {
        "learn",
        "learning",
        "help",
        "helping",
        "advice",
        "someone",
        "looking",
        "want",
        "wanting",
        "getting",
        "started",
        "start",
        "good",
        "know",
        "knows",
        "tips",
        "get",
        "find",
        "finding",
        "people",
        "person",
        "really",
        "stuff",
        "things",
        "thing",
        "like",
        "love",
        "interested",
        "experience",
        "general",
        "new",
        "meet",
        "meeting",
        "talk",
    }
)
STOP_WORDS = ENGLISH_STOP_WORDS | INTAKE_STOP_WORDS

_PHRASE_SPLIT = re.compile(r"[,;:.!?/|()\n]+|\s+(?:and|or|&)\s+")
_TOKEN = re.compile(r"[a-z][a-z0-9+#\-]*[a-z0-9+#]|[a-z]")


def phrase_ngrams(text: str) -> list[str]:
    """Unigrams and bigrams that never cross punctuation or "and".

    Intake answers are lists ("SQL, data analysis"). Default n-grams would invent
    "sql data", which nobody wrote. Splitting into phrases first keeps every
    bigram something a person actually typed.
    """
    out: list[str] = []
    for phrase in _PHRASE_SPLIT.split(text.lower()):
        # Framing words are dropped as unigrams but kept inside bigrams, so
        # "machine learning" survives while a bare "learning" never matches.
        words = [w for w in _TOKEN.findall(phrase) if w not in ENGLISH_STOP_WORDS]
        out.extend(w for w in words if w not in INTAKE_STOP_WORDS)
        out.extend(
            f"{a} {b}"
            for a, b in zip(words, words[1:], strict=False)
            if not (a in INTAKE_STOP_WORDS and b in INTAKE_STOP_WORDS)
        )
    return out


@runtime_checkable
class TextEncoder(Protocol):
    def fit(self, corpus: Sequence[str]) -> TextEncoder: ...

    def transform(self, docs: Sequence[str]) -> np.ndarray:
        """Return one L2-normalized row per doc. Empty docs become zero rows."""
        ...


def _l2_normalize(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


class TfidfVectorizer:
    """Minimal TF-IDF, numerically identical to scikit-learn's
    `TfidfVectorizer(analyzer=..., sublinear_tf=True)` with default smoothing and
    L2 norm (tests/test_tfidf.py checks this). Kept in-house so the deployed API
    doesn't carry scikit-learn and SciPy: about 150 MB lighter and a much faster
    cold start.

        tf  = 1 + ln(count)
        idf = ln((1 + n_docs) / (1 + doc_freq)) + 1
        row = tf * idf, then L2-normalized
    """

    def __init__(self, analyzer) -> None:
        self.analyzer = analyzer
        self.vocabulary_: dict[str, int] = {}
        self.idf_ = np.zeros(0)

    def fit(self, docs: Sequence[str]) -> TfidfVectorizer:
        counts = [Counter(self.analyzer(d)) for d in docs]
        df: Counter[str] = Counter()
        for c in counts:
            df.update(c.keys())
        if not df:
            raise ValueError("empty vocabulary")
        terms = sorted(df)
        self.vocabulary_ = {t: i for i, t in enumerate(terms)}
        n = len(docs)
        self.idf_ = np.array([math.log((1 + n) / (1 + df[t])) + 1 for t in terms])
        return self

    def get_feature_names_out(self) -> np.ndarray:
        return np.array(sorted(self.vocabulary_, key=self.vocabulary_.get), dtype=object)

    def transform(self, docs: Sequence[str]) -> np.ndarray:
        out = np.zeros((len(docs), len(self.vocabulary_)))
        for row, doc in enumerate(docs):
            for term, count in Counter(self.analyzer(doc)).items():
                col = self.vocabulary_.get(term)
                if col is not None:
                    out[row, col] = (1 + math.log(count)) * self.idf_[col]
        return _l2_normalize(out)


class TfidfEncoder:
    """Default encoder: free, offline, deterministic, and explainable.

    Fit per event. Small corpora (30 to 200 attendees) are exactly where TF-IDF
    does well: the vocabulary is the event's own vocabulary.
    """

    def __init__(self) -> None:
        self._vec = TfidfVectorizer(analyzer=phrase_ngrams)
        self._fitted = False
        self._empty = False

    def fit(self, corpus: Sequence[str]) -> TfidfEncoder:
        docs = [d for d in corpus if d and d.strip()]
        if not docs:
            self._empty = True
        else:
            try:
                self._vec.fit(docs)
            except ValueError:  # every token was a stop word
                self._empty = True
        self._fitted = True
        return self

    @property
    def feature_names(self) -> np.ndarray:
        if self._empty:
            return np.array([], dtype=object)
        return self._vec.get_feature_names_out()

    def transform(self, docs: Sequence[str]) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("call fit() before transform()")
        if self._empty:
            return np.zeros((len(docs), 1))
        # Rows are L2-normalized; empty docs come out as zeros.
        return self._vec.transform([d or "" for d in docs])


class EmbeddingsEncoder:
    """Optional: any OpenAI-compatible /embeddings endpoint.

    Better at synonyms ("UX" vs "user research") but costs money and can't explain
    itself at the word level, so explanations still use TF-IDF terms.
    """

    def __init__(
        self,
        url: str,
        api_key: str | None,
        model: str,
        client: httpx.Client | None = None,
        batch_size: int = 96,
    ) -> None:
        self.url = url
        self.api_key = api_key
        self.model = model
        self.batch_size = batch_size
        self._client = client or httpx.Client(timeout=30)

    def fit(self, corpus: Sequence[str]) -> EmbeddingsEncoder:
        return self

    def transform(self, docs: Sequence[str]) -> np.ndarray:
        rows: list[list[float] | None] = [None] * len(docs)
        todo = [(i, d) for i, d in enumerate(docs) if d and d.strip()]
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        dim = 0
        for start in range(0, len(todo), self.batch_size):
            chunk = todo[start : start + self.batch_size]
            resp = self._client.post(
                self.url,
                headers=headers,
                json={"model": self.model, "input": [d for _, d in chunk]},
            )
            resp.raise_for_status()
            data = sorted(resp.json()["data"], key=lambda x: x["index"])
            for (i, _), item in zip(chunk, data, strict=True):
                rows[i] = item["embedding"]
                dim = len(item["embedding"])
        dim = dim or 1
        out = np.array([r if r is not None else [0.0] * dim for r in rows], dtype=float)
        return _l2_normalize(out)
