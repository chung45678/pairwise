# Pairwise design doc

**Status:** Implemented in v1
**Related:** [PRD.md](PRD.md), [ROADMAP.md](ROADMAP.md), [BENCHMARK.md](BENCHMARK.md)

---

## 1. Goals and constraints

- **Runs for free.** Clubs have no budget. The default path needs no paid API, and the app runs as one container on a free tier.
- **Explainable.** Every match shows *why*. If the reason looks wrong, the organizer can catch it before publishing.
- **Nobody left out.** Coverage is a hard guarantee, not a nice-to-have.
- **Small enough for one person to maintain.** One backend, one frontend, one database file.

## 2. Architecture

```
                 ┌───────────────────────────────────────────────┐
 Organizer ────▶ │  React + TypeScript SPA (Vite, Tailwind)       │
 Attendee  ────▶ │  /           create event                      │
                 │  /e/:slug/admin   dashboard (admin key)        │
                 │  /e/:slug/join    intake form                  │
                 │  /m/:token        my matches + feedback        │
                 └──────────────────────┬────────────────────────┘
                                        │ JSON over /api
                 ┌──────────────────────▼────────────────────────┐
                 │  FastAPI                                       │
                 │  ├─ api/        routes, auth deps, schemas     │
                 │  ├─ importers/  Luma CSV → Attendee            │
                 │  ├─ matching/                                  │
                 │  │   ├─ encoders.py   TF-IDF | embeddings API  │
                 │  │   ├─ scoring.py    pair score matrix        │
                 │  │   ├─ solver.py     k-round optimal matching │
                 │  │   └─ explain.py    reasons + icebreakers    │
                 │  └─ metrics.py   conversation rate, coverage   │
                 └──────────────────────┬────────────────────────┘
                                        │ SQLModel (SQLAlchemy)
                               SQLite (dev) / Postgres (prod)
```

In production FastAPI also serves the built SPA, so the whole app ships as one Docker image.

**Why this stack**

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Backend language | Python | TypeScript (Next.js) | The matching engine leans on numpy, scikit-learn and networkx. Rewriting blossom matching in TS is risk with no upside. |
| API framework | FastAPI | Django, Flask | Typed request/response models from Pydantic, auto OpenAPI docs, and a test client with no server needed. |
| ORM / DB | SQLModel + SQLite | Postgres from day one | Zero setup locally. `DATABASE_URL` switches to Postgres with no code changes. |
| Frontend | React + Vite + TS | Next.js | It's an SPA behind an API. Next's server features would go unused and add a second server. |
| Auth | Unguessable tokens in links | Accounts / OAuth | Accounts are the #1 drop-off for a 60-second form. Tokens are 128-bit, so they can't be guessed. Trade-off covered in §7. |

## 3. Data model

```
Event ──< Attendee ──< Feedback >── Match >── Event
```

| Table | Key fields |
|---|---|
| `event` | `slug` (public), `admin_key` (secret), `name`, `starts_at`, `matches_per_person`, `status` (`draft` → `matched` → `published`) |
| `attendee` | `event_id`, `name`, `email`, `role`, `affiliation`, `interests` (JSON list), `looking_for`, `can_help_with`, `token` (secret), `intake_complete`, `source` (`luma` / `intake`) |
| `match` | `event_id`, `a_id`, `b_id`, `score`, `round`, `reasons` (JSON), `icebreaker` |
| `feedback` | `match_id`, `attendee_id`, `outcome` (`talked` / `missed` / `skipped`), `rating` 1 to 5. Unique on (`match_id`, `attendee_id`) so re-submitting updates instead of duplicating. |

`(event_id, email)` is unique on `attendee`. Importing Luma and then having the same person fill the intake form merges into one row.

## 4. Matching engine

Matching runs in three stages. Each one is a pure function with its own tests.

### 4.1 Encode text (`encoders.py`)

Each attendee has three text signals: **interests** (tags), **looking_for** (free text), **can_help_with** (free text).

`TextEncoder` is a protocol with one method: `encode(list[str]) -> ndarray` (L2-normalized rows).

- **`TfidfEncoder` (default).** Fit per event on all attendee text with sublinear TF. Free, offline, deterministic, and its vectors map back to real words. That's what makes explanations possible (§4.4). It uses a custom analyzer, `phrase_ngrams`, because intake answers are lists:
  - Text is split into phrases on punctuation and "and"/"or" first, so bigrams never cross list items. Default n-grams turn "SQL, data analysis" into a fake "sql data" term.
  - Framing words ("learning", "advice", "someone", "looking"...) are dropped as unigrams but kept inside bigrams. "Learning SQL" and "machine learning" no longer match on "learning", but "machine learning" survives as a term.
- **`EmbeddingsEncoder` (optional).** Any OpenAI-compatible `/embeddings` endpoint, set by env vars. Better on synonyms ("UX" vs "user research"), but costs money and loses word-level explanations. So reasons still come from TF-IDF terms even when embeddings drive the score.

### 4.2 Score pairs (`scoring.py`)

For attendees *i* and *j*, with cosine similarity `sim`:

```
help(i←j)   = sim(looking_for_i, can_help_with_j)        # j can give what i wants
complement  = (help(i←j) + help(j←i)) / 2                # value in both directions
shared      = 0.5 · jaccard(tags_i, tags_j) + 0.5 · sim(interests_i, interests_j)
diversity   = 1 if role_i ≠ role_j else 0

score(i,j)  = 0.55 · complement + 0.35 · shared + 0.10 · diversity
              − 0.50 · [same affiliation]                # they probably already know each other
```

The result is a symmetric `n × n` matrix with `-inf` on the diagonal. The weights live in a `ScoringWeights` dataclass, so the benchmark can sweep them.

**Why complementarity has the highest weight.** Two PMs who both love fintech have an easy conversation, but a PM who wants design feedback meeting a designer who offers portfolio reviews is the match people remember. Shared interests make it easy to start. Complementarity makes it worth having.

### 4.3 Solve (`solver.py`)

**Problem.** Give each attendee up to *k* distinct matches and maximize total score. Formally this is maximum-weight *b*-matching with *b = k*.

**Options considered**

| Option | Quality | Coverage | Complexity |
|---|---|---|---|
| A. Random pairing | Baseline | Good | Trivial |
| B. Greedy: sort all edges, take an edge while both ends have capacity | ½-approximation; popular people soak up the best edges | Poor: low scorers get stranded | O(n² log n) |
| C. **k rounds of max-weight matching** (Edmonds' blossom, max-cardinality), removing used edges each round | Each round is optimal; overall near-optimal | Max cardinality means at most one person sits out per round | O(k · n³), fine for n ≤ 500 |
| D. Exact b-matching via ILP | Optimal | Configurable | Needs a solver dependency; slower; little gain over C (see benchmark) |

**Chosen: C**, with a coverage repair step:

1. For each round `r = 1..k`, build a graph of unused edges with weight `score + offset` (the offset keeps weights positive, so blossom is never tempted to skip an edge), and run `max_weight_matching(maxcardinality=True)`.
2. With an odd headcount one person is left out each round. **Repair:** attach them to their best-scoring partner who isn't already a match, so that partner gets *k+1* matches. That's a small trio rather than someone standing alone.
3. Return matches tagged with the round they came from. Round 1 is the "best match" shown first on the card.

[BENCHMARK.md](BENCHMARK.md) compares A, B and C on synthetic events with known ground truth.

### 4.4 Explain (`explain.py`)

Each match gets 1 to 3 **reasons** and one **icebreaker**.

- **Reasons are built from evidence, not generated.** Complementarity reasons come from the element-wise product of the two TF-IDF vectors. Its top terms are the literal words that overlap, for example *"Maya is looking for **design feedback**. Jordan can help with that."* Terms that sit next to each other in what the person wrote are merged back into their phrase (`critique` + `ux` + `design` → "critique my UX design"), so reasons read like the person's own words. Shared-interest reasons list the overlapping tags. A different-roles reason fires when diversity contributed.
- **Names:** reasons use first names, or full names when both people share a first name.
- **Icebreakers** come from an `IcebreakerWriter` protocol:
  - `TemplateWriter` (default): picks a template by the strongest reason type and fills in the evidence terms. Seeded by match ID, so it's deterministic.
  - `ClaudeWriter` (optional, `ANTHROPIC_API_KEY`): sends only the two profiles' non-PII fields and the computed reasons to the Messages API. On any error it falls back to the template, so a bad API call never blocks an event.

## 5. API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/events` | none | Create event, returns `admin_key` once |
| GET | `/api/events/{slug}` | none | Public event info for the intake page |
| POST | `/api/events/{slug}/intake` | none | Create or update attendee by email, returns `token` |
| GET | `/api/admin/events/{slug}` | admin | Event + attendees |
| POST | `/api/admin/events/{slug}/import` | admin | Upload Luma CSV, returns an import report |
| POST | `/api/admin/events/{slug}/match` | admin | Run matching (replaces any draft) |
| POST | `/api/admin/events/{slug}/publish` | admin | Make matches visible to attendees |
| GET | `/api/admin/events/{slug}/matches[.csv]` | admin | Review or export |
| GET | `/api/admin/events/{slug}/metrics` | admin | Dashboard numbers |
| GET | `/api/me/{token}` | token | My profile + matches (once published) |
| POST | `/api/me/{token}/feedback` | token | Outcome + rating for one match |

Admin auth uses the `X-Admin-Key` header, compared with `hmac.compare_digest` so response timing can't leak the key.

## 6. Metrics (`metrics.py`)

- **Conversation rate** = matches where any participant reported `talked` ÷ matches with any feedback. It also shows the rate over all matches, since the response bias in that first number is real and should be visible.
- **Average rating** over `talked` responses.
- **Coverage** = attendees with ≥ 1 match ÷ attendees with completed intake.
- **Funnel**: registered → intake complete → matched → gave feedback.
- **By round**: conversation rate for round-1 vs round-2+ matches. If round 1 isn't clearly better, the scoring isn't working. This is the main signal for tuning weights.

## 7. Security and privacy

- Match pages show a match's name, role, affiliation and interests. Emails are never returned by attendee-facing endpoints.
- Tokens and admin keys are `secrets.token_urlsafe(16)` (128 bits).
- Trade-off: anyone holding a link has access, so a forwarded link is a shared link. That's fine for a club mixer. v2 adds organizer accounts.
- No scraping or third-party enrichment. Data is whatever the attendee typed or the organizer uploaded.
- The optional LLM path sends no emails and no names. The prompt uses first names only.

## 8. Testing

- **Unit:** encoders, scoring symmetry and penalties, solver invariants (no self-matches, no duplicates, coverage, capacity ≤ k+1), Luma header mapping, explanation evidence.
- **API:** full organizer and attendee flow through FastAPI's `TestClient` against an in-memory DB.
- **Property-style:** solver invariants checked across random sizes and seeds, odd and even counts.
- **Benchmark:** `python -m benchmarks.run` regenerates BENCHMARK.md and its chart.
