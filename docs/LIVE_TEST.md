# Live test plan

The benchmark proves the algorithm works on synthetic data. This proves it works on people.

## Event

- **Where:** one UW PM or UW Blueprint social. Target 30 to 60 guests.
- **Matches per person:** 2
- **Owner:** Chung (running Pairwise) + one exec at the door

## Hypotheses

| # | Hypothesis | Pass if |
|---|---|---|
| H1 | Guests will fill a 60-second form before an event | ≥ 60% of registered guests complete intake |
| H2 | Suggested matches turn into conversations | Conversation rate ≥ 40% among matches with feedback |
| H3 | The ranking matters: best matches beat later ones | Round-1 conversation rate is ≥ 10 points above round 2 |
| H4 | Conversations are worth having | Average rating ≥ 3.8 / 5 |
| H5 | Organizers can run it without me | A second exec sets up the next event in < 5 min, unassisted |

## Timeline

| When | What |
|---|---|
| T-7 days | Create event. Add the intake link to the Luma confirmation email and the club Discord or Slack. |
| T-2 days | Reminder message with the intake link. Import the Luma CSV to catch anyone who answered the registration questions there. |
| T-1 day | Generate matches. Read 10 random pairs. Fix any obviously wrong answers. **Send.** |
| T-0, doors open | Short announcement: "Open your Pairwise link. Find your two people. The highlighted words are why." |
| T-0, mid-event | Exec at the door helps anyone who signed up late meet someone. |
| T+1 day | Message: "Did you talk to your matches? Tap once on your link." |
| T+3 days | Pull metrics. Five-minute calls with 3 guests who rated low and 3 who rated high. |

## What to record

From the dashboard (Results tab):
- Funnel: registered → intake → matched → feedback
- Conversation rate (answered matches and all matches)
- Average rating
- Round-1 vs later conversation rate

By hand:
- Organizer setup time (stopwatch)
- Questions guests asked at the door: each one is a UX bug
- The 3 worst-rated matches and why they happened (bad intake answer? scoring? no-show?)

## Survey (in the T+1 message, optional)

1. Did Pairwise make it easier to start a conversation? (Yes / A bit / No)
2. What would have made your matches better? (free text)
3. Would you want this at the next event? (Yes / No)

## Decision after the test

- **H2 and H3 pass:** ship to a second club, then tune weights on real feedback (ROADMAP v2 item 2).
- **H2 passes, H3 fails:** scoring isn't adding much over "any intro". Revisit intake questions before touching the algorithm.
- **H1 fails:** the problem is getting answers, not matching. Move intake into Luma registration questions so it's a required step.
- **H2 fails:** interview the no-shows and "couldn't find them" guests first. It may be a logistics problem (name tags, room size) rather than a matching problem.

## Results

*Fill in after the event.*

| Metric | Target | Actual |
|---|---|---|
| Intake completion | ≥ 60% | |
| Conversation rate | ≥ 40% | |
| Round-1 vs later | +10 pts | |
| Average rating | ≥ 3.8 | |
| Organizer setup time | < 5 min | |
