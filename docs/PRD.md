# Pairwise PRD

**Author:** Chung He
**Status:** v1 shipped (MVP), v2 scoped
**Inspired by:** Bubble Lab (YC W26), rebuilt as an open-source tool for student clubs

---

## 1. Problem

Club networking events have a known failure mode: people arrive, find the two friends they came with, and leave. The organizer's goal (new connections) and the attendee's goal (meet someone useful without awkwardness) both fail.

What I see running events for UW Blueprint and UW Product Management:

- **Attendees don't know who's in the room.** The Luma guest list is just names. Nobody knows who shares their interests.
- **Cold intros are awkward.** Even when two people should meet, neither has a reason to walk over.
- **Organizers can't measure success.** We count RSVPs and attendance. We never find out if anyone actually connected.

Bubble Lab solves this for professional communities at $99/mo, gated behind a sales demo. Student clubs have no budget and no time for a demo call. The need is the same and the price point is zero.

## 2. Target users

| Persona | Who | Job to be done |
|---|---|---|
| **Organizer** (primary buyer) | Events or culture exec at a student club, runs 2 to 6 events a term | "Make my event the one where people actually meet someone, and prove it to my club." |
| **Attendee** (primary user) | Student attending a club social, mixer, or project night | "Tell me 2 or 3 people worth meeting and give me an easy opener." |

Not targeting: conference organizers with 1,000+ attendees, paid communities, or recruiters. Those are Bubble Lab's market.

## 3. Core user flows

**Flow A: Organizer sets up an event (target: under 5 minutes)**
1. Create event (name, date, matches per person).
2. Import the Luma guest CSV, or share the intake link.
3. Attendees fill a 60-second intake: role, interests, what they want to meet someone for, what they can help with.
4. Organizer clicks **Generate matches**, reviews them, and publishes.

**Flow B: Attendee gets matches**
1. Opens their personal link (no account, no password).
2. Sees 2 or 3 match cards: name, why they match, and an icebreaker.
3. Finds them at the event.

**Flow C: Feedback loop (24 hours after)**
1. Attendee opens the same link and taps, for each match, "We talked" / "Didn't find them" / "Skipped", plus a 1 to 5 rating.
2. Organizer sees the dashboard: conversation rate, average rating, coverage.

## 4. Success metrics

| Metric | Definition | MVP target |
|---|---|---|
| **Conversation rate** (north star) | Matches where at least one side reports "We talked" ÷ total matches | ≥ 40% |
| Match quality | Average rating on "We talked" matches | ≥ 3.8 / 5 |
| Intake completion | Attendees who finished intake ÷ registered | ≥ 60% |
| Feedback response | Attendees who left feedback ÷ attendees matched | ≥ 30% |
| Organizer setup time | Event create to matches published | < 5 min |

Guardrail: **no one left out.** Every attendee with a completed intake gets at least one match (coverage = 100%).

## 5. Scope

### MVP (v1, built)
- Event creation, Luma CSV import with automatic column mapping
- Public intake form per event
- Matching engine: pluggable text similarity, complementarity scoring, k-round optimal matching
- Explainable match reasons and icebreakers (template-based, optional LLM)
- Private per-attendee match page via unguessable token
- Feedback form and organizer metrics dashboard
- CSV export of matches (for mail merge or Slack)

### v2 (scoped, not built)
- Slack app: DM each attendee their matches
- Luma API sync instead of CSV
- LLM-written icebreakers on by default (needs a hosted key)
- Organizer accounts and multi-club workspaces
- Mid-event "rematch" for people whose matches didn't show up

### Non-goals
- **No LinkedIn scraping.** It violates LinkedIn's terms and attendees never consented. Pairwise only uses what attendees tell it.
- No chat or messaging. The point is to meet in person.
- No attendee accounts. A token link removes the biggest drop-off point.

## 6. Risks and assumptions

| Risk | Mitigation |
|---|---|
| Low intake completion | Keep the form to 4 fields, under 60 seconds. Pre-fill name and email from Luma. |
| Bad matches erode trust | Show *why* two people matched. Organizer reviews before publishing. |
| Odd attendee counts leave someone out | Matching guarantees coverage with a fallback pass (see DESIGN.md). |
| Feedback is sparse | One tap per match, sent from the same link they already used. |
| Privacy | Match pages are token-gated. Only name, role and interests are shown to matches, never email. |

## 7. Launch plan

1. Dogfood at one UW PM event (target 30 to 60 attendees). See [LIVE_TEST.md](LIVE_TEST.md).
2. Fix the top 3 issues from feedback.
3. Run at a UW Blueprint event and compare conversation rate.
4. Open-source release, share with other UW club execs.
