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
| User research | Not done. Nobody outside this project has used it. | None yet. |

## Detectors, frozen

Defined in `apps/docs/src/harness/detect.ts`.

| Detector | Reports | Threshold |
|---|---|---|
| Stale final state | At the end, the rendered state or the field's visibility disagrees with the last user request. | Exact |
| Geometry jump | A frame much faster than its neighbors, on height, width, x, y or the field's offset inside the box, at any moment. | Over 60 px, and over 3 times the faster of the two neighbor medians. Four frames on each side. Frames within 80 ms of a viewport resize are skipped. |
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
| `motion-height` | `motion.div` with `animate={{ height: 'auto' }}`, with the spring below |
| `motion-measured` | Motion animating a numeric height measured by ResizeObserver. About 30 more lines. |
| `motion-layout` | `motion.div` with `layout`, conditional panel in `AnimatePresence`, same spring |
| `native-grid` | CSS transition on `grid-template-rows`, 320 ms |

`surface` and all the Motion baselines use the same equation: a period of 320 ms with critical damping, which is stiffness 385.5 and damping 39.27. All five get the same content. Every baseline gets a plain focus rule, a plain removal rule and a plain guard on deferred close, so that the comparison is about geometry. The field's value is lifted to the page.

The baselines are good code. A baseline passing a scenario is a result to report, not a problem.

## Comparison 3: clean package against the development workspace

The same application source, built from the workspace and from the installed tarball. Compared by behavior and bundle size.

## Timing workload, frozen

Chromium, headless, 1280 by 800, device scale 2, recorder off. Each run is a fresh browser process. Each run contains:

1. Warmup: 4 toggles, not measured.
2. 6 full moves from rest, 900 ms apart. Measures click to first changed frame.
3. 12 reversals, 110 ms apart, then 700 ms to settle. Measures layout, style, script and task time from Chrome's `Performance.getMetrics`, plus frame callback intervals and turnaround.
4. 6 keystrokes into the field during a reversal. Measures keydown to first frame showing the character.

7 runs per implementation in round-robin order. The first run is dropped whole as a warmup, leaving 6.

## Definitions

- **Input latency**: from `event.timeStamp` of the click or keydown to a message delivered after the first animation frame where the page shows a change. It is a lab measure on one machine, and it is not field INP.
- **Turnaround**: from the click to the first frame that moves against the old direction. A box that ignores the click never turns, and that is counted as a missed turn. A spring that carries velocity turns later on purpose, so a larger number here is not a slower response. It is a different motion.
- **Frame callback interval**: time between `requestAnimationFrame` timestamps. It does not prove what the display showed.
- **Layout count, layout ms**: Chrome's counters across the reversal workload.
- **Reported value**: the median of each run's value, with the minimum and maximum across runs. Samples inside a run are not treated as independent.

## Leak symptoms, frozen

500 cycles of open, remove and restore, after 50 warmup cycles, 5 runs each, for `surface`, `motion-height` and the `broken-leak` control. After a forced collection, record DOM nodes, event listeners and JS heap, plus active observers, intervals and animation frame calls after removal.

Pass criterion: `surface` shows no growth in DOM nodes or listeners, no active observers or intervals after removal, and no animation frame calls while removed. Heap growth is reported and has no pass line, because a heap reading is noisy. `broken-leak` must show symptoms, or the method is invalid. This cannot prove the absence of a leak.

## Size method

esbuild bundle of the tarball installed in a clean app, minified, ESM, React external, gzip level 9. React's own cost is reported once on its own.

## Budgets, frozen before the final run

These come from the first baseline, in `results/baseline`, plus a margin. They were committed before the final run and before any tuning. Sizes are gzipped JavaScript with React excluded.

| Budget | Baseline | Limit |
|---|---|---|
| Surface import | 3,601 bytes | 4,096 bytes |
| Inspector import | 5,884 bytes | 6,500 bytes |
| ModalInspector import | 29,453 bytes | 31,000 bytes |
| Timeline import | 15,793 bytes | 17,000 bytes |
| ActionBar import | 11,545 bytes | 12,500 bytes |
| Each foundation component over Base UI directly | 418 bytes at most | 512 bytes |
| Barrel import of Button over the subpath import | Smaller | 64 bytes |
| `styles.css` | 4,493 bytes | 5,120 bytes |
| `tokens.css` | 1,102 bytes | 1,280 bytes |
| Surface, click to first change from rest | 12.6 ms | 20 ms |
| Surface, key to first change mid-move | 8.5 ms | 16 ms |
| Surface, layouts in the reversal workload | 139 | 150 |
| Surface, main thread task time in the reversal workload | 59.3 ms | 75 ms |
| Surface, frame intervals over 25 ms in the reversal workload | 0 | 2 |
| Foundation latency over Base UI directly | 1.8 ms at most | 3 ms |
| Foundation task time over Base UI directly | 6 percent at most | 15 percent |
| Foundation layout count over Base UI directly | 0 | 0 |

## Other pass criteria

- No stale final state and no lost focus in the interruption suite, in Chromium, Firefox and WebKit.
- The simplest import brings no signature component: the Button-only page has no Inspector, Surface, Timeline or ActionBar code.
- A closed control becoming active moves nothing around it. In Chrome's layout shift entries for the ActionBar, the only source is the bar itself, and no entry counts toward CLS.

## Changes after this file was first written

| Change | Reason |
|---|---|
| A run lost to a closed browser is repeated and logged in the manifest. | A browser closed mid-run during the first baseline attempt. Repeating only on a lost browser cannot select for good numbers. |
| The ActionBar criterion was reworded from "score of 0". | The bar's own entrance creates raw entries, all marked as following input, which CLS excludes. The requirement is about surrounding content, so the test now checks that. |
| An independent review on a clean clone changed the detectors, the baselines and one metric, after the first baseline and before any final run. See the table below. | The review found the suite was blind to the worst engine bug, and that the comparison was tilted toward the library. |
| The first baseline used 3 runs, 200 leak cycles and 2 leak runs. | It only sets budgets. The final run uses the full protocol above. |

## What the independent review changed

| Found | Change |
|---|---|
| The jump detector read height only, and only near a request. The worst bug, a 355 px jump in position, was invisible to it. | It now reads height, width, x, y and the field's offset on every frame. |
| `motion-height` and `native-grid` ignored the fallback ref they were given, so they failed the removal scenario for a harness reason. | All baselines now have the plain removal rule. |
| `motion-layout` had no focus rule, despite this file saying that it did. | It now has the same rule as the others. |
| The growth-at-rest scenario tested something `height: auto` cannot do. A 30 line Motion version passed. | That version is now a baseline, `motion-measured`. |
| `visualDuration: 0.32` is a period of 384 ms, not 320 ms. | Motion baselines now use explicit stiffness and damping, for the same equation. |
| Click to first change, reversing, was empty: a moving box changes on the next frame whether or not it heard the click. | Replaced by turnaround, with missed turns counted. |
| No seeded mutant covered translate, width, radius, the content lock or velocity on a content retarget. | Added browser continuity tests and mutants for these. |
