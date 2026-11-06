# Measurement plan

This file was written before the final measurement. It fixes the workload, the metrics, the baselines and the pass criteria. Changes after the freeze are listed at the end, with the reason.

## Separate kinds of evidence

| Kind | What it answers | Where |
|---|---|---|
| State-model tests | Does the logic hold, with no browser? | `packages/react/test`, `apps/docs/src/harness/detect.test.ts` |
| Browser behavior tests | Does it work in real browsers? | `e2e/` |
| Interruption suite | Does it hold up when interrupted, by the same detectors? | `e2e/scenarios.ts` |
| Performance measurements | What does it cost? | `bench/` |
| Heuristic review | Does it read well to its author? | `docs/REPORT.md` |
| User research | Not done. Nobody outside this project has used it. | `docs/USABILITY.md` has the script. |

## Detectors, frozen

Defined in `apps/docs/src/harness/detect.ts`.

| Detector | Reports | Threshold |
|---|---|---|
| Stale final state | At the end, the rendered state or the field's visibility disagrees with the last user request. | Exact |
| Geometry jump | A frame just after a request that is much faster than its neighbors. | Over 60 px, and over 3 times the faster of the two neighbor medians. Four frames on each side. Three frames checked after each request. |
| Focus lost | Focus on `<body>` after the surface owned focus. | 2 consecutive samples |
| Text stretch | The field is drawn at a size that differs from its layout size. | Over 1 percent |
| Duplicate interactive | More than one reachable copy of the field. | Exact |
| Value lost | The field's final value is not what was typed. | Exact |

Samples are taken after each frame's rendering work, using a message posted from `requestAnimationFrame`. Three changes were made while building the detector, before any final result, and each came from reading real traces:

1. The jump reference became two-sided, because a spring from rest moves fast while the frames before it are still.
2. The reference became a median, because a nearby spike hid a jump in the `broken-restart` control.
3. The sampling point moved to after the frame, because a read inside `requestAnimationFrame` saw a size that was never painted.

The `jumpMinPx` floor rose from 24 to 60 for the reason stated in the code. Jumps below 60 px are not detected.

## Interruption suite, frozen

Eight scenarios in `e2e/scenarios.ts`: reverse twice then type, many fast reversals, deferred close over a reopen, closing with focus inside, content growth during a move, content growth at rest, viewport change during a move, and removal during a move.

Pass criterion for the library: zero violations in the declared browsers.

Each seeded broken control must be caught by its scenario. A control that goes undetected invalidates the suite.

## Comparison 1: foundation components against Base UI directly

Same interaction, same class names and CSS, in `apps/docs/src/pages/FoundationCompare.tsx`. Sizes for all eight components. Timing for Dialog, Popover and Select.

## Comparison 2: Surface against ordinary implementations

| Name | Implementation |
|---|---|
| `surface` | This library's Inspector |
| `motion-height` | `motion.div` with `animate={{ height: 'auto' }}`, spring with `visualDuration` 0.32 and no bounce |
| `motion-layout` | `motion.div` with `layout`, conditional panel in `AnimatePresence`, same spring |
| `native-grid` | CSS transition on `grid-template-rows`, 320 ms |

The spring period for `surface` is 320 ms with damping 1. All four get the same content. Baselines get a plain focus rule and a plain guard on deferred close, so that the comparison is about geometry. Their fixture value is lifted to the page.

The baselines are good code. A baseline passing a scenario is a result to report, not a problem.

## Comparison 3: clean package against the development workspace

The same application source, built from the workspace and from the installed tarball. Compared by behavior and bundle size.

## Timing workload, frozen

Chromium, headless, 1280 by 800, device scale 2, recorder off. Each run is a fresh browser process. Each run contains:

1. Warmup: 4 toggles, not measured.
2. 6 full moves from rest, 900 ms apart. Measures click to first changed frame.
3. 12 reversals, 110 ms apart, then 700 ms to settle. Measures layout, style, script and task time from Chrome's `Performance.getMetrics`, plus frame callback intervals and click to first changed frame.
4. 6 keystrokes into the field during a reversal. Measures keydown to first frame showing the character.

7 runs per implementation in round-robin order. The first run is dropped whole as a warmup, leaving 6.

## Definitions

- **Input latency**: from `event.timeStamp` of the click or keydown to a message delivered after the first animation frame where the page shows a change. It is a lab measure on one machine, and it is not field INP.
- **Frame callback interval**: time between `requestAnimationFrame` timestamps. It does not prove what the display showed.
- **Layout count, layout ms**: Chrome's counters across the reversal workload.
- **Reported value**: the median of each run's value, with the minimum and maximum across runs. Samples inside a run are not treated as independent.

## Leak symptoms, frozen

500 cycles of open, remove and restore, after 50 warmup cycles, 5 runs each, for `surface`, `motion-height` and the `broken-leak` control. After a forced collection, record DOM nodes, event listeners and JS heap, plus active observers, intervals and animation frame calls after removal.

Pass criterion: `surface` shows no growth in DOM nodes or listeners, no active observers or intervals after removal, and no animation frame calls while removed. Heap growth is reported and has no pass line, because a heap reading is noisy. `broken-leak` must show symptoms, or the method is invalid. This cannot prove the absence of a leak.

## Size method

esbuild bundle of the tarball installed in a clean app, minified, ESM, React external, gzip level 9. React's own cost is reported once on its own.

BUDGETS
