# Pairwise redesign: reference study, spec and audit

Status: **waiting for approval** (Phases 1 to 3). No UI code has changed yet.
Branch: `redesign/motion`

---

## Phase 1: Reference study

Both sites were inspected live in a real browser at 1440 and 375px. Timings below are read from the pages' own computed styles and live `animationstart` / `transitionstart` events, so durations and cubic-beziers are exact, not eyeballed.

**Tooling found:** neither site uses GSAP, Lenis, Framer Motion or Webflow. ProDex is Next.js + Tailwind v4 + CSS modules with hand-written keyframes and an `IntersectionObserver` that adds `.in-view`. Florian Kiem is Tailwind v4 with CSS transitions and a little inline-style JS (image blur-up). **Everything that moves is plain CSS.** That's the strongest signal for how we should build it.

### ProDex Labs (prodexlabs.com)

**Layout**
- Container max 1440px with 24 to 32px gutters. Body copy is held to `42rem` max.
- Long, single-column story: 11 sections, alternating `section-flow` (168px top padding) and `section-plate` (200px, on a deeper surface tone). The rhythm comes from changing surface tone, not from rules or borders.
- Hero is centered, then logo row, then a full-bleed video that expands on scroll.

**Type**
- One family, **GT America**, plus Commit Mono for small data labels and Druk Wide for rare accents.
- **One weight: 400.** The theme literally maps bold, semibold and medium to 400. Hierarchy comes from size and tracking only.
- Scale: 10 / 12 / 14 / 16 / 18 / 24 / 36 / 40 / 80px.
- Tracking tightens as size grows: 80px at -0.04em (-3.2px), 36 to 40px at -0.04em, body at -0.005em.
- Line-height: 1.02 at 80px, 1.1 at 36px, 1.55 for body.

**Color**
- Surfaces: `#fdfdfc` background, `#fafaf9` surface, `#f6f5f0` warm surface plus deeper variants.
- Ink: `#1c1919` with muted `#8c8989`. One signal blue (`#2c69a8`) inside product visuals only.
- Depth comes from layered shadows plus a hairline ring, never a plain border. For example, the card shadow is a 1px inset white highlight, a 1px ring at 7% black, and three soft drops.

**Components**
- **Pill buttons.** The primary is a dark pill with an arrow inside a white circle. On hover the arrow nudges 2px (200ms ease-out). On press the background darkens a few percent. There's no scale anywhere.
- **Nav links:** 14px with a 150ms color/opacity change.
- **Header** hides when you scroll down and comes back when you scroll up.
- **Cards** are flat surfaces with hairline shadows.

**Motion inventory**

| # | Element | Trigger | Properties | Duration | Easing | Delay / stagger | Distance | Plays |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero h1, subline, CTA (`hero-in`) | load | opacity, translateY | 750ms | `cubic-bezier(0.22,1,0.36,1)` | 60 / 220 / 360ms | 12px | once |
| 2 | Hero subline characters (`CharReveal`) | load | opacity per character | 0ms each | n/a | 400ms, then +15ms per character | none | once, so it reads like typing |
| 3 | Section blocks (`.reveal`) | scroll-in | opacity, translateY | 600ms | `cubic-bezier(0.22,1,0.36,1)` | none | 60px | once |
| 4 | Lists (`.reveal-stagger`) | scroll-in | opacity, translateY | 500ms | same | 80ms per child, up to 12 | 16px | once |
| 5 | Quote (`.reveal-blur`) | scroll-in | opacity, translateY, blur 10px to 0 | 600ms | same | 80ms | 16px | once |
| 6 | Product panel rows (`dxcBlockIn`) | scroll-in | opacity, translateY | 520ms | same | sequenced | 6px | once |
| 7 | Bar charts (`dxcGrow`) | scroll-in | scaleY from 0 | 620ms | same | staggered | n/a | once |
| 8 | Chart curve (`dxcDraw`) | scroll-in | stroke-dashoffset | 1100ms | same | none | n/a | once |
| 9 | "Iterating scenarios…" (`dxcShimmer`) | while working | background-position | 1900ms | linear | none | n/a | **loops, only while it represents work** |
| 10 | Industry carousel | click / autoplay | width, margin, scale | 620ms | `cubic-bezier(0.32,0.72,0,1)` | none | n/a | per change, 4.2s autoplay progress bar |
| 11 | Header bar | scroll direction | translateY | 520ms in / 340ms out | `(0.16,1,0.3,1)` in, `(0.4,0,0.6,1)` out | none | 100% | per change |
| 12 | Expanding video | scroll-linked | frame size, caption opacity | continuous | n/a | n/a | n/a | scrubbed |

**Micro-interactions**
- Arrow nudge on CTAs: 2px, 200ms ease-out.
- Press: background darkens to 9 to 13% ink. No scale.
- Focus: 3px ring at 50% of the signal color.
- 404: giant "404" in the display face, then a plain list of where to go.
- 36 separate `prefers-reduced-motion` rules. Every entrance has an explicit "final state, no transition" fallback.

### Florian Kiem (floriankiem.com)

**Layout**
- Max 2560px. A sticky left column (290px: intro, plus a "Selected work" list that tracks your scroll position) and a 762px right column of project frames.
- 24px page padding. Lots of black space. Frames sit on a slightly lighter panel.
- On mobile it becomes one column with a **floating bottom pill nav**.

**Type**
- **Haas Recast** (Pretendard fallback). Nearly everything is **14px**, and the intro is only 16px.
- Weights 460 and 530 (variable). Hierarchy comes from color (white vs. gray `#969696`) far more than size.
- Line-height around 1.5.

**Color**
- Pure black `#000` page, white text, gray secondary.
- Radius 4px on buttons. Layered "smooth" shadows (5 stacked drops at 2 to 5% opacity).

**Motion inventory**

| # | Element | Trigger | Properties | Duration | Easing | Plays |
|---|---|---|---|---|---|---|
| 1 | Nav links | hover | color | **50ms** | `(0.4,0,0.2,1)` | per hover |
| 2 | Work list arrow | hover | opacity 0 to 1, blur 2px to 0, translate (-2px, 2px) to 0 | 150ms | `(0.4,0,0.2,1)` | per hover |
| 3 | Work list active item | scroll position | color gray to white | 150ms | same | per section |
| 4 | Project images | load | blur-up placeholder (blur 20px, scale 1.1) crossfades to the image | 400ms | ease-out | once |
| 5 | Videos | load | opacity | 300ms | `(0,0,0.2,1)` | once |
| 6 | Contact button | click | morphs into a panel. Mail icon wipes in via `clip-path` | 450ms | `(0.16,1,0.3,1)` | per click |
| 7 | Scroll containers | scroll-linked | top and bottom mask fade (`animation-timeline: scroll`) | continuous | linear | scrubbed |

**404:** one quiet line plus four small buttons, centered in black space.

### What makes it "minimal but alive"

1. **One curve for everything that arrives.** Almost every entrance uses `cubic-bezier(0.22, 1, 0.36, 1)`: fast start, very long settle. That one choice is why it feels expensive rather than bouncy.
2. **Short travel, long settle.** Things move 3 to 16px over 450 to 750ms. Distance is tiny, so motion reads as focus, not travel. Blur makes the arrival feel like a camera pull-focus.
3. **Feedback is near-instant; arrival is slow.** Hover and press resolve in 50 to 200ms. Only content arriving gets the long curve. The interface never makes you wait on itself.
4. **Motion means something.** Loops exist only for "work in progress" (shimmer, autoplay progress). Charts grow because they're data. Nothing moves just to decorate.
5. **Restraint carries the hierarchy.** One weight (ProDex) or two (Florian). Hierarchy comes from size, tracking and gray, with depth from hairline shadows instead of borders. A quiet base is what makes the motion visible.

---

## Phase 2: Spec

### Tokens (`frontend/src/index.css` `@theme`)

**Color.** The signature stays: cobalt tag, yellow marker, mint shared. The base gets quieter and more neutral.

| Token | Now | Proposed | Why |
|---|---|---|---|
| `--color-paper` | `#f4f6fa` | `#f6f7f9` | Less blue cast, so cobalt is the only "color" on the page. Not a warm cream, which would read as a template. |
| `--color-ink` | `#161b2e` (navy) | `#14161b` | A neutral ink that lets the tag own the blue |
| `--color-muted` | `#5a6278` | `#666c79` | Softer gray. 4.91:1 on paper, 5.27:1 on white |
| `--color-hairline` | n/a | `rgb(20 22 27 / 0.08)` | Replaces most 1px borders |
| `--color-tag` / `--color-marker` / `--color-mint` | unchanged | unchanged | The signature |

All text pairs are at least 4.5:1. Ink on marker is 13:1 and on mint 13.5:1. White on cobalt is 7.8:1, and white at 80% on cobalt is 5.6:1. The lightest gray (`#7d828e`, 3.6:1) is for non-text only.

**Type.** This is the brand call I flagged in our first exchange. **Recommended:** keep Bricolage Grotesque, but *only* for the name on each name tag and the one big number or headline per screen, at weight **500** instead of 700. Everything else is IBM Plex Sans at **400 and 500 only**. The 600 and 700 weights go away.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| display (hero, results number) | 64px / 1.02 (mobile 44px) | Bricolage 500 | -0.035em |
| title (page h1) | 40px / 1.08 (mobile 32px) | Bricolage 500 | -0.025em |
| tag name | 30px / 1.05 | Bricolage 500 | -0.02em |
| heading (h2) | 20px / 1.3 | Plex 500 | -0.01em |
| body | 16px / 1.6 | Plex 400 | 0 |
| small | 14px / 1.5 | Plex 400 / 500 | 0 |
| micro | 13px / 1.4 | Plex 400 | 0 |

**Spacing and layout.** 4px base. Section rhythm is 96px on desktop and 64px on mobile. Container widths: `--w-read` 680px (intake, my matches), `--w-app` 1120px (dashboard), hero 1200px. Content stays left-aligned except the 404.

**Radius.** Tag 14px, card 12px, control 10px, chip 8px. Pills are reserved for status only.

**Depth.**
- `--shadow-card`: `0 0 0 1px hairline, 0 1px 2px rgb(0 0 0/.04), 0 8px 24px -12px rgb(0 0 0/.10)`
- `--shadow-tag`: cobalt-tinted version of the card shadow
- Inputs keep a 1px border because form fields need a visible edge.

### Motion tokens

| Token | Value | Used for |
|---|---|---|
| `--dur-instant` | 80ms | color, background, text-decoration feedback |
| `--dur-quick` | 180ms | hover nudges, icon swaps, press, chip pop |
| `--dur-base` | 520ms | entrances, scroll reveals, list staggers |
| `--dur-slow` | 760ms | hero and the one signature moment per screen |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | everything that arrives |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | feedback (hover, press, color) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | things that open or resize (disclosure, confirm panel, tab indicator) |
| `--rise-sm / md / lg` | 6px / 12px / 24px | chips and rows / blocks / sections |
| `--blur-in` | 8px | blur-in entrances (one per screen at most) |
| `--stagger` | 60ms per item, capped at 8 items | lists |

### Motion rules

1. Animate `transform`, `opacity` and `filter` only. Two exceptions: the marker sweep (`background-size`), and disclosure open/close (`grid-template-rows`, ProDex's method, which causes no layout jump after it settles).
2. Feedback resolves in 180ms or less. Nothing blocks input while animating, and buttons are clickable the moment they're visible.
3. Every entrance plays once. Loops exist only while something is genuinely working (generating matches, importing a CSV, loading).
4. **At most one signature moment per screen.** Everything else uses the shared reveal.
5. Content that holds the answer (results number, match names) must be readable within 300ms. No count-ups and no typewriter on data.
6. Lists stagger at most 8 items. After that, items appear together so a 40-row list never takes 2.4s.
7. **Reduced motion:** every entrance renders its final state with no transition. The marker shows fully highlighted with no sweep. Bars render at full width. Color feedback stays because it isn't motion. Implemented in one `@media (prefers-reduced-motion: reduce)` block plus a JS check for anything observer-driven.
8. **Focus:** a 3px cobalt ring with 2px offset on every interactive element, shown with `:focus-visible` only. Focus never animates.

### Signature moments (one per screen)

| Screen | Signature moment | Supporting motion (shared system) |
|---|---|---|
| Landing | **Name tags deal in.** Two tags drop 24px and rotate into their resting tilt with 140ms between them, then the marker sweeps the evidence words in reading order. | Headline and subline rise 12px (60 / 180ms). Steps stagger on scroll. |
| Intake | **Chip pop.** An added interest drops from the input into the tag row (scale 0.92 to 1, rise 6px, 180ms). Removing one collapses it. | Fields reveal as one group on load. |
| My Matches | **Highlighter on scroll.** As each match card enters the viewport, its evidence words are swept in order at 120ms intervals. That's the moment you learn *why*. | Cards rise 12px. The feedback rating row opens with the drawer curve. The selected rating fills with the marker. |
| My Matches (not sent yet) | **The "waiting" card** blurs in once. No loop, because nothing is working. | none |
| Admin: Guests | **Import lands.** After a CSV upload, the summary blurs in and newly added rows stagger in (cap 8). | Drop zone lifts 2px with a cobalt ring on drag-over. |
| Admin: Matches | **Pairs deal out.** After "Generate matches", the pairs stagger in (cap 8, the rest appear together) and each row's marker sweeps as it arrives. | The send confirmation opens as a drawer. The tab underline slides between tabs. |
| Admin: Results | **The headline number focuses in** (blur 8px to 0, 12px rise, 760ms). No count-up, per our earlier decision. | Funnel bars grow from 0 (scaleX, 80ms stagger). Table rows reveal. |

**Shared micro-interactions:**
- **Buttons:** 80ms color change, press darkens the background (no scale).
- **Primary actions that go somewhere** (Create event, Save and get my link): the arrow nudges 2px.
- **Copy buttons:** the icon swaps to a check with a blur crossfade (180ms).
- **Links:** color only, 80ms.
- **Tabs:** one sliding underline indicator.
- **Long pages:** the header hides on scroll down and returns on scroll up.
- **Loading states:** use a skeleton with a shimmer instead of the "Loading" spinner text, so the layout doesn't jump.

### Implementation approach
- **No animation library.** Every moment above is achievable with CSS keyframes and transitions, a ~40-line `useReveal` hook (`IntersectionObserver` that adds `data-in`), and a CSS `--i` variable for staggers. That's exactly how both references are built.
- The `motion` package would earn its place only for layout animation (FLIP). The one candidate is the tab indicator, and it can be done by measuring the active tab and translating one element. So: no dependency. I'll revisit only if something can't be done cleanly.

---

## Phase 3: Audit of the current UI

Screens were captured at 1440 and 375px (16 screenshots, contact sheets attached). The Lighthouse baseline below uses Lighthouse's default mobile emulation with simulated throttling.

| Page | Perf | A11y | Best practices | LCP | CLS | A11y issues |
|---|---|---|---|---|---|---|
| Landing | 100 | 97 | 100 | 0.9s | 0.037 | heading-order |
| Intake | 92 | 100 | 100 | 3.4s | 0 | none |
| My Matches | 91 | 98 | 100 | 3.5s | 0 | heading-order |

### Scores against the spec (1 = far, 5 = there)

| Screen | Tokens / type | Depth | Feedback | Entrance | Signature | Mobile | Notes |
|---|---|---|---|---|---|---|---|
| Landing | 3 | 2 | 2 | 2 | 2 | 4 | One marker sweep, tags are static |
| Intake | 3 | 2 | 2 | 1 | 1 | 4 | Chips appear with no feedback |
| My Matches | 3 | 2 | 2 | 1 | 1 | 4 | Marker is static |
| My Matches (not sent) | 3 | 2 | n/a | 1 | n/a | 4 | Dashed card is fine |
| Admin: Guests | 3 | 2 | 2 | 1 | 1 | **1** | **Page overflows at 375px** |
| Admin: Matches | 3 | 2 | 2 | 1 | 1 | 3 | Green notice block is heavy |
| Admin: Results | 3 | 3 | n/a | 1 | 1 | 4 | Bars are static |

### Gaps, ranked by impact

1. **Bug: the Guests tab overflows on mobile.** The 640px-min table plus the side-by-side layout pushes the page wider than 375px, so the whole dashboard renders zoomed-out (see `5-admin-guests@375`). The fix is layout only, with no copy or data change.
2. **Nothing arrives; it pops.** Every data page renders a blank "Loading" line and then snaps in. This is the biggest gap to the references, and it also drives the 3.4s LCP on intake and my-matches. The fix is skeletons plus the shared reveal.
3. **Signature moments are missing** on My Matches (static marker), Matches (no reveal after Generate) and Results (static bars). These are the screens people actually show.
4. **Too many weights.** Four weights plus a bold display face fight the "restraint carries the hierarchy" principle. Every h1 is 44px/700.
5. **Borders everywhere.** Cards, tables, notices and dropzones all use 1px borders. The references get depth from hairline shadows and surface tone.
6. **Feedback is color-only.** There's no press state, no arrow nudge, the copy confirmation is an abrupt swap, and tabs have no moving indicator.
7. **Heading order** fails a11y on Landing (h3 steps before the h2) and My Matches (h4 labels under h3). The fix is semantic only.
8. **Heavy notices.** The full-width green "Sent" block and the blue "Bookmark" block are the loudest things on their screens. They should be quieter inline status.
9. **No scroll behavior on long pages.** On a 40-pair Matches list the header just scrolls away. It should hide and return.

### Out of scope unless you say so
- **Copy changes.** None are needed for any item above.
- **Dark mode.** Florian's site is dark, but the brief didn't ask for it, and the name-tag concept reads best on paper.

---

## Approval needed

1. **Type** (the recommendation above): Bricolage only for tag names and the one hero number or headline per screen, at weight 500. Plex at 400 and 500 for everything else.
2. **Palette:** move from a navy-tinted ink and cool paper to a neutral ink and more neutral paper. Cobalt, marker and mint are unchanged.
3. **No animation library** (CSS plus one small hook).
4. **Gap #1 (mobile overflow)** gets fixed as part of the redesign even though it's technically a bug fix.

Reply "approved", or tell me which of the four to change. Phase 4 starts after that.
