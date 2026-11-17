# Roadmap

Built part-time around school (weekday evenings + weekends). Each milestone ends with something demoable.

## ✅ M1: Foundations
- [x] Repo setup: backend/frontend monorepo, ruff, pytest, CI on GitHub Actions
- [x] Data model: Event, Attendee, Match, Feedback (SQLModel)
- [x] Create event endpoint with admin key
- **Acceptance:** `pytest` passes in CI; `POST /api/events` returns a slug and admin key.

## ✅ M2: Getting attendees in
- [x] Luma CSV importer with header auto-mapping and an import report (added / updated / skipped + reasons)
- [x] Public intake form endpoint, merged by email
- [x] Intake UI with interest tags
- **Acceptance:** Importing a real Luma export and then filling intake for one guest gives one merged attendee row.

## ✅ M3: Matching engine
- [x] `TextEncoder` protocol + TF-IDF encoder
- [x] Pair scoring with weights dataclass
- [x] k-round blossom solver + odd-count repair
- [x] Solver invariant tests across random sizes
- **Acceptance:** 100% coverage for n = 2..60; no duplicates; capacity ≤ k+1.

## ✅ M4: Explainability + attendee experience
- [x] Evidence-based reasons from TF-IDF term overlap
- [x] Template icebreakers + optional Claude writer with fallback
- [x] Attendee match page (token link)
- **Acceptance:** Every match has ≥ 1 reason citing real words from both profiles.

## ✅ M5: Organizer dashboard + feedback loop
- [x] Dashboard: attendees, generate/review/publish matches, CSV export
- [x] Feedback endpoint (idempotent upsert)
- [x] Metrics: conversation rate, rating, coverage, funnel, by-round
- **Acceptance:** Setup-to-publish under 5 minutes for a 40-person CSV.

## ✅ M6: Proof
- [x] Synthetic benchmark vs random and greedy baselines
- [x] Dockerfile (single image), demo seed script
- [x] README case study
- [ ] **Live test at a UW PM event** (see [LIVE_TEST.md](LIVE_TEST.md))
- [ ] Add live results to the README

## v2 backlog (prioritized)
1. **Slack DMs.** Send each attendee their matches in Slack. Most clubs already live there.
2. **Weight tuning from feedback.** Fit scoring weights on real `talked` outcomes (logistic regression on the score components).
3. **Rematch.** "My match didn't show up" gets a new match from attendees who checked in.
4. **Luma API sync** instead of CSV upload.
5. **Organizer accounts** to replace admin links.
