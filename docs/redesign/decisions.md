# Redesign decisions and where they came from

Each decision maps to the reference observation behind it ([motion-spec.md](motion-spec.md), Phase 1) or to a direct instruction from Chung. "Kept" means it's a Pairwise signature that the references didn't touch.

## Visual

| Decision | Source |
|---|---|
| Pure black page, white ink, gray secondary | Florian Kiem: `#000` page, white text, gray `#969696` secondary. Black theme was requested by Chung. |
| Name tags stay white with a cobalt band ("paper objects") | Kept. On Florian's site, light project screenshots sit in dark frames, so light objects on a dark stage is part of that language. |
| No logo, just a wordmark | Requested by Chung. Florian's site has only a text mark ("Fk"). |
| One display face for one moment per screen, everything else in 2 weights | ProDex maps every weight to 400. Florian uses 460 and 530 only. Both get hierarchy from size, tracking and gray instead of weight. |
| Tighter tracking as size grows (-0.03 to -0.035em on display) | ProDex: 80px at -0.04em, 36 to 40px at -0.04em, body near 0 |
| Small UI text (13 to 15px), muted labels | Florian: nearly everything is 14px |
| Hairline ring plus soft stacked shadow instead of borders | ProDex `--shadow-panel-card` and `--shadow-raised` (1px ring at 5 to 7% plus soft drops). Florian `--smooth-shadow-*` (5 stacked drops at 2 to 5%). |
| Section rhythm from surface and spacing, not dividers | ProDex alternates surface tones with 168 to 200px section padding |
| Quiet inline notices instead of filled color blocks | Both sites: status is never a big color slab. Audit gap #8. |
| White primary button, ghost secondary, no scale on press | ProDex: press darkens the background by 9 to 13%, and nothing scales. Florian: plain fills, 4px radius. |

## Motion

| Decision | Source |
|---|---|
| `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for every arrival | ProDex `.reveal`, `hero-in`, `dxcBlockIn`, `dxcGrow` and `dxcDraw` all use it |
| `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` for sliding (tab indicator, count picker) | ProDex industry carousel, 620ms |
| Header hides on scroll down (340ms, `(0.4,0,0.6,1)`) and returns on scroll up (520ms, `(0.16,1,0.3,1)`) | ProDex `HeaderShell`. The durations and curves are the same. |
| Short travel (6 / 12 / 24px), long settle (520 to 760ms) | ProDex rises 6 to 16px over 500 to 750ms. Florian's arrow moves 2px. |
| Stagger 60ms, capped at 8 | ProDex `.reveal-stagger` uses 80ms per child and caps at 12. I chose shorter and lower so a 40-row list never drags. |
| Blur-in once per screen (results number, pending card, import summary) | ProDex `.reveal-blur` (blur 10px to 0) and solutions hero (blur 8px). Florian's image blur-up. |
| 80ms color feedback | Florian nav links: 50ms. ProDex buttons: 150ms. I picked the middle. |
| Arrow nudges 2px on primary actions | ProDex Book Demo: arrow `group-hover:translate-x-0.5`, 200ms ease-out |
| Copy icon swaps with a blur crossfade | Florian work-list arrow: opacity, blur(2px) and a 2px offset, 150ms |
| Skeleton shimmer while loading (the only loop) | ProDex `dxcShimmer` loops only while something is "working". Florian has `skeleton-shimmer`. |
| No count-up on Results, the number focuses in | Agreed with Chung up front: the number is the answer, so don't make people wait for it |
| No animation library | Neither reference uses one. Both are CSS keyframes plus a small observer. |
| Full reduced-motion fallback for every animation | ProDex ships 36 `prefers-reduced-motion` rules, each giving a final state with no transition |

## Pairwise signature moments (inspired by, not copied)

| Moment | Reference principle it applies |
|---|---|
| Name tags deal in, then the marker sweeps | ProDex hero stagger (60 / 220 / 360ms) and its "motion means something" rule: the sweep *is* the explanation |
| Highlighter on scroll (My Matches) | ProDex scroll reveals plus `dxcDraw` (a stroke drawn in on view) |
| Pairs deal out after Generate | ProDex `dxcBlockIn` panel rows (6px, 520ms, sequenced) |
| Funnel bars grow | ProDex `dxcGrow` (scale from 0, 620ms) |
| Sliding tab underline | ProDex carousel geometry plus Florian's scroll-tracking active list |

## Deviations from the approved spec (and why)

| Change | Why |
|---|---|
| Light theme became dark | Chung's request after the spec |
| Entrances start at opacity 0.01, not 0 | Lighthouse treated the faded-in hero h1 as late. With 0.01 the landing page's LCP returns to 0.9s and performance to 100. |
| Only the first 8 list rows animate, the rest use `content-visibility: auto` | Animating every row's marks on a 40-pair list cost about 100ms of extra main-thread blocking. Capping it brings the admin page back to its baseline score. |
| Dropped `backdrop-filter` on the header | It recomposited the page under every animation frame |
| Below `md`, the guest table drops the Role and Interests columns | Fixes the 375px overflow (audit gap #1) without horizontal scrolling |
