# Redesign verification

## Before / after
- [compare-1440.png](compare-1440.png), [compare-768.png](compare-768.png), [compare-375.png](compare-375.png): every screen, before on top and after below. The 7 screens are landing, intake, my matches, my matches before matches are sent, and the admin Guests, Matches and Results tabs, plus the 404 page.

## Animation sequences
Each was recorded at real speed with the Chrome DevTools screencast, then sampled at the timestamps shown. Each has a PNG contact sheet plus a GIF in [sequences/](sequences).

| Sequence | What it shows |
|---|---|
| `a-landing` | Headline rises, name tags deal in and settle at -2° and 1.5°, then the marker sweeps three words in order (done by about 1.9s) |
| `b-highlight-on-scroll` | Second match card reveals as it scrolls in, then its evidence highlights sweep in reading order |
| `c-generate` | Regenerate: rows deal out with a 60ms stagger, and each row's marks sweep after it lands |
| `d-results` | Tab switch: the number focuses in (blur to sharp, readable by about 300ms), stats stagger, funnel bars grow |
| `e-chip-pop` | An interest chip pops in (180ms) |
| `f-tab-indicator` | The underline slides from Guests to Results (520ms, drawer curve) |

## Lighthouse (mobile emulation, simulated throttling)

| Page | Before (perf / a11y / best practices) | After | LCP before → after | CLS after |
|---|---|---|---|---|
| Landing | 100 / 97 / 100 | **100 / 100 / 100** | 0.9s → 0.9s | 0 |
| Intake | 92 / 100 / 100 | 91 / 100 / 100 | 3.4s → 3.5s | 0 |
| My Matches | 91 / 98 / 100 | 91 / **100** / 100 | 3.5s → 3.5s | 0 |
| Admin: Matches (40 pairs) | 87 / 100 / 100 | 86 to 88 / 100 / 100 (3 runs) | 4.0s → 3.9 to 4.1s | 0.001 |

Accessibility fixed two heading-order failures and is now 100 everywhere. Performance is within run-to-run noise on every page. The admin page needed three fixes to get there (see [decisions.md](decisions.md), deviations).

LCP on intake, My Matches and admin is about 3.5 to 4s both before and after. That cost comes from waiting for the API before the first render, not from motion. The skeletons make that wait look intentional, but they can't make it shorter. Server-side rendering of the first screen is the real fix, and it's out of scope here.

## Reduced motion (`prefers-reduced-motion: reduce`, checked 60ms after load)

| Screen | Running animations | Marks fully drawn | Elements not fully visible |
|---|---|---|---|
| Landing | none | 3 / 3 | 0 |
| Intake | none | n/a | 0 |
| My Matches | none | 9 / 9 | 0 |
| Admin: Matches | none | 113 / 113 | 0 |
| Admin: Results | none | n/a | 0 |

## Keyboard only

| Flow | Result |
|---|---|
| Landing: tab through, fill the event name, press Enter to create | Works. 12 stops. 11 show the focus ring. The exception is one sub-field inside Chrome's built-in date-time picker. |
| Admin: tab through, switch tabs with Enter | Works. 9 stops, all with a visible ring |
| My Matches: tab to "We talked", Enter, tab to "4 out of 5", Enter | Works. "Saved" is announced through `aria-live`. 9 stops, all visible. |
| Intake: tab through every field and suggestion | 17 stops, all visible |

## Tests
- `npm test`: 12 passing
- `npm run typecheck`: clean
- `npm run e2e`: passing. It now also checks the admin guest list for horizontal overflow on mobile.
- Backend: 119 passing (unchanged)
