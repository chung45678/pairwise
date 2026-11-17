import httpx
import numpy as np

from pairwise.matching import Profile, run_matching
from pairwise.matching.encoders import EmbeddingsEncoder, TfidfEncoder
from pairwise.matching.explain import (
    ClaudeWriter,
    TemplateWriter,
    build_reasons,
    render_reason,
    top_overlap_terms,
)
from pairwise.matching.scoring import build_features

MAYA = Profile(
    1,
    "Maya Chen",
    "Product Manager",
    "",
    ("fintech", "user research"),
    "design feedback on my mockups",
    "roadmapping, user interviews",
)
JORDAN = Profile(
    2,
    "Jordan Lee",
    "Designer",
    "",
    ("figma", "user research"),
    "learn roadmapping",
    "design feedback, figma, portfolio reviews",
)


def test_bigram_replaces_unigrams():
    vocab = np.array(["design", "design feedback", "feedback", "figma"], dtype=object)
    u = np.array([0.3, 0.6, 0.3, 0.0])
    v = np.array([0.3, 0.6, 0.3, 0.5])
    assert top_overlap_terms(u, v, vocab) == ["design feedback"]


def test_reasons_cite_real_words_from_both_profiles():
    enc = TfidfEncoder()
    f = build_features([MAYA, JORDAN], enc)
    reasons = build_reasons(f, 0, 1, enc.feature_names)
    comp = [r for r in reasons if r["type"] == "complement"]
    assert comp, reasons
    for r in comp:
        seeker = MAYA if r["seeker"] == 1 else JORDAN
        helper = JORDAN if r["helper"] == 2 else MAYA
        for term in r["terms"]:
            assert term in seeker.looking_for.lower()
            assert term in helper.can_help_with.lower()
    assert any(r["type"] == "shared" and "user research" in r["terms"] for r in reasons)


def test_render_is_viewer_relative():
    r = {"type": "complement", "seeker": 1, "helper": 2, "terms": ["design feedback"]}
    names = {1: "Maya", 2: "Jordan"}
    assert (
        render_reason(r, names) == "Maya is looking for design feedback. Jordan can help with that."
    )
    assert render_reason(r, names, viewer=1).startswith("You're looking for")
    assert render_reason(r, names, viewer=2).endswith("You can help with that.")


def test_template_writer_is_deterministic():
    reasons = [{"type": "shared", "terms": ["fintech"]}]
    w = TemplateWriter()
    assert w.write(MAYA, JORDAN, reasons) == w.write(MAYA, JORDAN, reasons)
    assert "fintech" in w.write(MAYA, JORDAN, reasons)


def test_claude_writer_parses_response_and_strips_pii():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = request.content.decode()
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": '"Ask about Figma."'}]}
        )

    w = ClaudeWriter(
        "key", "claude-haiku-5-5", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    assert w.write(MAYA, JORDAN, []) == "Ask about Figma."
    assert "Chen" not in seen["body"] and "Lee" not in seen["body"]  # first names only


def test_claude_writer_falls_back_on_error():
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(529)))
    w = ClaudeWriter("key", "m", client=client)
    reasons = [{"type": "shared", "terms": ["fintech"]}]
    assert w.write(MAYA, JORDAN, reasons) == TemplateWriter().write(MAYA, JORDAN, reasons)


def test_embeddings_encoder_batches_and_normalizes():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        inputs = json.loads(request.content)["input"]
        calls.append(len(inputs))
        return httpx.Response(
            200,
            json={
                "data": [
                    {"index": i, "embedding": [float(len(t)), 1.0]} for i, t in enumerate(inputs)
                ]
            },
        )

    enc = EmbeddingsEncoder(
        "http://x/embeddings",
        "k",
        "m",
        batch_size=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    out = enc.fit([]).transform(["a", "", "abc", "ab"])
    assert calls == [2, 1]  # the empty doc is never sent
    assert np.allclose(out[1], 0)
    assert np.allclose(np.linalg.norm(out[[0, 2, 3]], axis=1), 1)


def test_pipeline_with_embeddings_still_explains_with_words():
    class FakeEncoder:
        def fit(self, corpus):
            return self

        def transform(self, docs):
            return np.ones((len(docs), 3)) / np.sqrt(3)

    results, stats = run_matching([MAYA, JORDAN], 1, encoder=FakeEncoder())
    assert stats.coverage == 1.0
    assert any(r["type"] == "complement" for r in results[0].reasons)


def test_merge_adjacent_terms_into_phrase():
    from pairwise.matching.explain import merge_adjacent

    assert merge_adjacent(["critique", "ux", "design"], "someone to critique my UX design") == [
        "critique my ux design"
    ]
    assert merge_adjacent(["sql", "dashboards"], "SQL now, and later some dashboards") == [
        "sql",
        "dashboards",
    ]


def test_machine_learning_survives_framing_stop_words():
    from pairwise.matching.encoders import phrase_ngrams

    grams = phrase_ngrams("getting started with machine learning")
    assert "machine learning" in grams
    assert "learning" not in grams and "getting started" not in grams


def test_icebreaker_uses_single_topic_not_merged_phrase():
    reasons = [
        {
            "type": "complement",
            "seeker": 1,
            "helper": 2,
            "terms": ["react and frontend"],
            "topic": "react",
        }
    ]
    text = TemplateWriter().write(MAYA, JORDAN, reasons)
    assert "react" in text and "react and frontend" not in text
