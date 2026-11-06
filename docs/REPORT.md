# Report

Measured on 2026-11-06 at commit `fb8b32c`, on one Apple M5 Pro Mac on AC power, in headless Chromium 158. Other work ran on the machine, including another session driving browsers. Load average was 2.5 to 8.3. Raw data is in `results/final`.

## Summary

- The library works: 12 components, 2 recipes, 2 working applications and a workbench, installed from a real tarball into 5 clean apps.
- `Surface` costs 4.2 KB of JavaScript, gzipped, with no dependency on Base UI or Motion.
- On timing, `Surface` is about level with Motion. It does more layouts.
- A careful Motion implementation of about 30 extra lines passes the same 8 interruption scenarios. What this library adds is the packaged contract and a far smaller download, not a win that Motion cannot reach.
- 14 of 17 frozen budgets were met. The 3 misses are reported below and the limits were not changed.

## What the numbers leave out

- All timing is from one machine, headless, with other load. It is not field data. Lab input latency is not INP.
- Frame callback intervals do not prove what the display showed.
- No real iOS or Android device was used. WebKit on macOS stands in for Safari, and it does not behave exactly like Safari.
- No screen reader session was run. Automated axe checks passed, and that does not establish full accessibility.
- Nobody outside this project has used the library.
- Only the eight comparison scenarios ran across all baselines. The library's other behavior tests have no baseline equivalent.

## Tests

| Kind | Count | Where |
|---|---|---|
| State model and engine, no browser | 48 | `packages/react/test`: 10 machine, 11 spring, 27 engine |
| Detectors, no browser | 19 | `apps/docs/src/harness/detect.test.ts` |
| Browser tests | 507 in each of 3 full runs: 192 Chromium, 145 Firefox, 145 WebKit, 25 StrictMode | `e2e/` |
| Interruption suite, library | 8 scenarios in each of 3 browsers, and in StrictMode | `e2e/interruption.spec.ts` |
| Comparison suite | 8 scenarios, 5 implementations, 5 runs each: 200 runs | `bench/correctness` |
| Negative controls | 9 checks over 6 seeded broken implementations | `e2e/negative-controls.spec.ts` |
| Mutation check | 55 deliberate defects. 53 caught, 2 equivalent. Unmodified code passed in the same sandbox. | `scripts/mutate.mjs`, `results/mutation` |

The browser matrix is Chromium 158, Firefox and WebKit from Playwright 1.65.0. Chromium runs everything. Firefox and WebKit run the behavior specs. axe, the layout shift check and the negative controls run in Chromium only. A separate Chromium project runs the interruption and Inspector specs on the development build, because StrictMode's extra effects only run there.

## Budgets

Frozen in `docs/PREREGISTRATION.md` before the final run. `results/final/budgets.json` has the same table.

| Budget | Measured | Limit | Result |
|---|---|---|---|
| Surface import, gzip bytes | 4,245 | 4,096 | **Missed** |
| Inspector import, gzip bytes | 6,838 | 6,500 | **Missed** |
| ModalInspector import, gzip bytes | 30,466 | 31,000 | Met |
| Timeline import, gzip bytes | 15,818 | 17,000 | Met |
| ActionBar import, gzip bytes | 12,194 | 12,500 | Met |
| Largest foundation cost over Base UI, gzip bytes | 418 | 512 | Met |
| Barrel Button over subpath Button, gzip bytes | -33 | 64 | Met |
| `styles.css`, gzip bytes | 4,683 | 5,120 | Met |
| `tokens.css`, gzip bytes | 1,102 | 1,280 | Met |
| Click to first change from rest, ms | 11.5 | 20 | Met |
| Key to first change mid-move, ms | 11.0 | 16 | Met |
| Layouts in the reversal workload | 163 | 150 | **Missed** |
| Task time in the reversal workload, ms | 55.4 | 75 | Met |
| Frame intervals over 25 ms | 0 | 2 | Met |
| Largest foundation latency over Base UI, ms | 1.6 | 3 | Met |
| Largest foundation task time over Base UI, percent | 10.3 | 15 | Met |
| Largest foundation layout count over Base UI | 0 | 0 | Met |

### Why three budgets were missed

The budgets came from the first baseline. A later review then found that the engine jumped for any box not anchored at its top left corner. The fix needs a second forced read at each request, to find where layout puts the box at its current size. The other fixes also added code. So:

- **Layouts rose from 139 to 163.** The count is a forced read per request, plus a frame-driven layout during the move. Task time did not rise, 59.3 ms to 55.4 ms within noise.
- **Surface grew by 644 bytes and Inspector by 954 bytes.**

A correct engine over budget beats a wrong one under it. The next bounded improvement is to skip the second read when a box has the same anchor as last time, and to drop the redundant Base UI hit area in `ModalInspector`.

## Comparison 1: foundation components against Base UI directly

Gzipped JavaScript for one import, React excluded. The same usage on each side. esbuild 0.28.2, minified, ESM.

| Component | This library | Base UI directly | Added bytes |
|---|---|---|---|
| Button | 3,355 | 3,199 | 156 |
| Input | 9,783 | 9,718 | 65 |
| Field | 9,888 | 9,761 | 127 |
| Select | 46,092 | 45,674 | 418 |
| Tabs | 13,860 | 13,670 | 190 |
| Popover | 41,603 | 41,236 | 367 |
| Dialog | 24,329 | 23,982 | 347 |
| Tooltip | 34,343 | 34,109 | 234 |

Timing, 6 runs, median with the range across runs, for 20 open and close cycles.

| Case | Latency, library (ms) | Latency, Base UI (ms) | Task time, library (ms) | Task time, Base UI (ms) | Layouts |
|---|---|---|---|---|---|
| Dialog | 10.4 (9.0 to 11.3) | 9.8 (8.4 to 10.8) | 127.6 (123.8 to 137.2) | 124.7 (120.1 to 160.8) | 80 and 80 |
| Popover | 12.1 (11.1 to 13.1) | 10.5 (7.3 to 11.6) | 164.0 (151.4 to 177.8) | 161.4 (125.6 to 195.9) | 100 and 100 |
| Select | 10.6 (8.7 to 11.1) | 10.2 (9.7 to 12.6) | 205.6 (171.3 to 214.9) | 186.5 (161.8 to 222.4) | 160 and 160 |

The ranges overlap in every row. The wrappers add no layouts. The foundation components are styles and a shorter API. That is all they claim to be.

Shared cost, once, for any library: React and React DOM are 69.2 KB gzipped at 19.3.1 and 45.9 KB at 18.3.1.

## Comparison 2: Surface against ordinary implementations

Five implementations of one fixture. `surface` and the three Motion baselines use the same spring equation, a period of 320 ms with critical damping. The CSS baseline is a 320 ms transition. Each baseline gets the same plain focus, removal and deferred-close rules, so that the comparison is about geometry.

### Interruption suite

5 runs of each scenario in Chromium. Cells show runs with a violation.

| Scenario | Surface | Motion, height auto | Motion, measured | Motion, layout | CSS grid |
|---|---|---|---|---|---|
| Reverse twice, then type | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |
| Many fast reversals | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |
| Deferred close over a reopen | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |
| Closing with focus inside | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |
| Content grows during a move | 0 of 5 | 5 of 5, jump | 0 of 5 | 5 of 5, stretch | 3 of 5, jump |
| Content grows at rest | 0 of 5 | 5 of 5, jump | 0 of 5 | 5 of 5, stretch | 5 of 5, jump |
| Viewport changes during a move | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |
| Removal with focus inside | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 | 0 of 5 |

The separation is narrow. Every baseline handles reversal, focus and stale work when given the plain rules. The only failures are content growth, for `height: auto` and CSS, which cannot animate to a size they do not know, and stretch, for the layout prop. `motion-measured` is clean.

An earlier draft of this table showed the library well ahead. That came from the harness, not the library. The later review section below explains how.

This table covers one panel shape in one layout. It does not test anchored shapes, sheets or transformed ancestors on the baselines. The library's continuity tests cover those, and no baseline was built for them. So this is not evidence that the baselines fail there.

### Timing and layout work

Median of 6 runs, with the range across runs. Lower is cheaper. These are from one machine.

| Measure | Surface | Motion, height auto | Motion, measured | Motion, layout | CSS grid |
|---|---|---|---|---|---|
| Click to first change, from rest (ms) | 11.5 (10.2 to 12.8) | 12.5 (11.0 to 13.9) | 11.0 (8.5 to 14.6) | 13.2 (9.9 to 14.4) | 28.0 (26.9 to 28.5) |
| Click to changed direction, mid-move (ms) | 27.8 (27.2 to 33.2) | 30.9 (26.6 to 31.3) | 30.2 (29.1 to 33.1) | 12.0 (9.5 to 12.8) | 25.8 (24.5 to 26.8) |
| Key to first change, mid-move (ms) | 11.0 (8.2 to 13.3) | 12.1 (8.0 to 14.3) | 9.3 (4.9 to 12.8) | 10.1 (7.8 to 12.0) | 7.6 (5.6 to 9.0) |
| Layouts in the reversal workload | 163 | 124 (123 to 133) | 117 (117 to 118) | 37 | 80 (80 to 87) |
| Layout time (ms) | 4.4 (3.4 to 4.9) | 4.7 (3.3 to 6.2) | 4.2 (3.6 to 5.0) | 1.2 (1.0 to 1.3) | 4.2 (3.9 to 6.3) |
| Style time (ms) | 5.3 (4.6 to 6.1) | 5.2 (3.9 to 6.8) | 4.8 (4.2 to 5.5) | 19.9 (16.4 to 21.8) | 4.4 (3.9 to 6.5) |
| Script time (ms) | 12.0 (10.1 to 13.9) | 12.9 (10.1 to 16.6) | 11.7 (10.4 to 13.0) | 22.7 (18.6 to 23.9) | 7.4 (6.9 to 11.7) |
| Main thread task time (ms) | 55.4 (46.4 to 64.0) | 60.7 (45.1 to 80.9) | 56.3 (49.1 to 65.2) | 81.8 (67.9 to 88.7) | 45.3 (41.2 to 71.4) |
| Frame intervals over 25 ms | 0 | 0 | 0 | 0 | 0 |

Reading this:

- **Surface, the height-based Motion baselines and CSS are all close.** Their ranges overlap on layout time and task time. None of these is a meaningful win.
- **Surface does more layouts than any baseline.** Each is cheap on this small page. On a page where a layout is expensive, the count matters more, and the layout prop's 37 would be the better choice.
- **The layout prop trades layout for style and script.** Its task time is the highest here. It also changes direction fastest. I did not establish why.
- **CSS is the cheapest.** Its 28 ms first change is partly the transition starting one frame later. It is not a slow response.
- A later turnaround is not a slower response. A spring that keeps its velocity carries on for a moment before it turns, on purpose.

### Size

| Import | Gzip |
|---|---|
| `Surface` | 4.1 KB |
| `Inspector` | 6.7 KB |
| `ModalInspector`, which includes Base UI Dialog | 29.8 KB |
| Motion, `motion.div` with `layout` | 44.1 KB |
| Motion, `motion.div` with `animate` | 44.2 KB |

If your app already ships Motion, its cost is zero to you, and the measured baseline may be the better choice. Surface is smaller when Motion is not already there.

## Comparison 3: clean package against the development workspace

The tarball is 35.3 KB. publint reports no problems.

| App | React | Bundler | Types | Build | SSR | Browser run |
|---|---|---|---|---|---|---|
| vite-react-18 | 18.3.1 | Vite 8.3.6 | Passed | Passed | Plain Node passed | Passed |
| vite-react-19.0 | 19.0.0 | Vite 8.3.6 | Passed | Passed | Plain Node passed | Passed |
| vite-react-19 | 19.3.1 | Vite 8.3.6 | Passed | Passed | Plain Node passed | Passed |
| next-react-18 | 18.3.1 | Next 16.1.6 | Passed | Passed | Next and plain Node passed | Passed, no hydration errors |
| next-react-19 | 19.3.1 | Next 16.4.5 | Passed | Passed | Next and plain Node passed | Passed, no hydration errors |

The Next 16.1.6 and React 18.3.1 row is what the portfolio has installed.

- A Button-only page contains no Inspector, Surface, Timeline or ActionBar code, and requests no fonts.
- The same app built from source and from the tarball: 144.4 KB and 145.7 KB of gzipped JavaScript, and the same CSS. The tarball build has a second entry, which changes chunking.

Clean consumers found a real bug. `Field.Root` failed in a React Server Component, because a client module's exports are opaque there. The workspace could not have shown this.

## Leak symptoms

500 cycles of open, remove and restore after 50 warmup cycles, 5 runs. After a forced collection.

| Measure | Surface | Motion, height auto | Broken control |
|---|---|---|---|
| DOM node growth | 0 | 0 | 0 |
| Event listener growth | 0 | 0 | 500 |
| Active observers after removal | 0 | 0 | 551 |
| Active intervals after removal | 0 | 0 | 551 |
| Frame calls while removed, in 300 ms | 0 | 0 | 12,122 |
| Heap growth (bytes) | 516,716 | 537,940 | 382,264 |

The counted resources return to zero, and the control shows that the counters see a leak. This does not prove there is no leak. Heap growth is similar across all three, including the control, so the heap reading here cannot tell them apart. It is not evidence either way.

## Review

A separate agent reviewed a clean clone, with the code and the contract and none of my conclusions. It then checked the fixes. This changed the project more than anything else did.

It found these, among others:

| Found | What it meant |
|---|---|
| A 355 px jump on the library's own bottom sheet, and on any box anchored right, bottom or center | The core geometry model was wrong. All tests were passing, because the detector read only height. |
| Baselines lacked rules this report claimed they had | The comparison was tilted toward the library. |
| The springs were not equal: 384 ms against 320 ms | Same. |
| A reversal latency metric that a box ignoring the click would also pass | The metric measured nothing, so it was replaced. |
| A 30 line Motion version passes the suite | The library's lead on that scenario was not real, so that version is now a baseline. |
| Consumer inline styles were destroyed, content-box roots broke, a modal stayed interactive while closing | Real bugs, now fixed. |
| Mutations to translate, width and radius passed every test | "Everything has a test" was false, so the claim was removed from the contract. |

The second pass found more: the new turnaround metric dropped samples, the new detector gave false failures, and the fix for Safari could steal focus. These are fixed too.

## Failures seen, and what is unexplained

| What happened | Status |
|---|---|
| Once, Firefox reported `Script terminated by timeout` in a full run, and its workers died. | **Unexplained.** I suspected an unstable ref and fixed it. Restoring the old ref did not bring the hang back, so that fix is not shown to be the cause. It has not recurred. Another session was using the machine at the time. |
| A browser closed mid-run during the first baseline attempt. | Cause not known. Runs now retry a lost browser and log it. The final run lost none. |
| One full run at the final commit had 60 WebKit timeouts, and no assertion failed. WebKit passed 142 of 142 right after, alone. | Probably a stalled WebKit process, not proven. See the passes below. |
| A modal could not be reopened by clicking the row during a close, in all browsers. | Fixed. The closing panel covered the row. |
| A clean clone could not install: pnpm refused esbuild's build script. | Fixed. The development checkout had hidden this. `results/clean-checkout.txt` now shows every step passing from a fresh clone. |
| The first mutation run reported 15 of 32, which was false. Vitest writes to stderr, and the script read stdout. | Fixed, by reading each failure's reason. |

After the last library change, the full matrix passed 507 of 507 three times in a row, with no Firefox hang and no WebKit timeouts. See `results/e2e/three-passes.txt`.

## Mutation check

Each mutant breaks one thing in a separate clone. I read the failing test for each catch, and each one targets the behavior that was broken. 52 were caught in the full run. `transition-not-suspended` survived, so I tightened that test, and it was caught in a follow-up run, in `results/mutation/transition-followup.json`.

Two survivors are equivalent, which is my judgment from reading the code:

- `focus-ignores-inert`: `moveFocus` already checks `activeElement` after focusing, and `focus()` does nothing on an inert element. So the check is redundant.
- `no-backdrop-dismissal`: Base UI's modal dialog has its own internal backdrop, so `Dialog.Backdrop` here is redundant. This is the cleanup named under the budgets.

The first attempts at this check were wrong in two ways. The script read the wrong output stream, and 7 mutants never applied because the code had moved. Both showed up only because I read the results rather than the score.

## Accessibility and review

axe found no violations on 9 pages in 4 combinations of theme and recipe, plus the open inspector and the open modal. That is automated checking only.

Visual review by the author, on real renders at 320, 390, 720, 768 and 1440 CSS pixels, in 3 passes: type and layout, interaction, and empty, error and interrupted states. This is a heuristic review. It is not user research. It found a misaligned ghost button, ticks over the thumb, a doubled focus ring, an action bar over the last row and a workbench that failed to report its own broken fixture. All are fixed. 200 percent zoom was approximated by halving the viewport.

## Contract coverage

| Rule | Covered by |
|---|---|
| M1 to M7 | `packages/react/test/machine.test.ts`, including 200 seeded random interleavings |
| Geometry, retarget, spring | `engine.test.ts`, `spring.test.ts`, `e2e/continuity.spec.ts` |
| Coordinate spaces | `e2e/geometry.spec.ts`, `e2e/continuity.spec.ts` |
| Content changes | `engine.test.ts`, `e2e/continuity.spec.ts`, two interruption scenarios |
| F1 to F7 | `e2e/inspector.spec.ts`, `e2e/continuity.spec.ts`, `e2e/components.spec.ts` |
| Reduced motion | `e2e/inspector.spec.ts`, `e2e/components.spec.ts` |
| Cleanup | `engine.test.ts`, `e2e/inspector.spec.ts`, leak measurements |

**No test:** the hidden-document snap is covered only with a fake port. `Scope` copying a recipe to a popup has no assertion. Touch input has no test. A real Safari quirk, that a click does not focus a button, is handled in code and was not tested in real Safari.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm test:e2e
node consumers/check.mjs
pnpm bench
node scripts/check-budgets.mjs baseline
```

`pnpm bench` writes to `results/baseline` by default. Pass `--label` to name a run.

## Where each result comes from

| Artifact | Path | Made by |
|---|---|---|
| Final measurement | `results/final/` | `node bench/run.mjs --label final` |
| Manifest | `results/final/manifest.json` | Same |
| Raw samples | `results/final/raw-timing.json`, `raw-foundation.json`, `raw-leaks.json`, `sizes.json` | Same |
| Budget table | `results/final/budgets.json` | `node scripts/check-budgets.mjs final` |
| First baseline | `results/baseline/` | `node bench/run.mjs --label baseline --runs 3 --leak-cycles 200 --leak-runs 2` |
| Comparison suite | `results/correctness/` | `bench/correctness`, then `scripts/correctness-summary.mjs` |
| Clean consumers | `results/consumers/summary.json` | `node consumers/check.mjs` |
| Workspace against tarball | `results/consumers/workspace-vs-clean.json` | `node bench/workspace-vs-clean.mjs` |
| Mutation check | `results/mutation/` | `node scripts/mutate.mjs` |
| Three full passes | `results/e2e/three-passes.txt` | `pnpm test:e2e`, three times |
| Clean checkout | `results/clean-checkout.txt` | `scripts/verify-clean.sh` |
| Evidence page data | `apps/docs/public/evidence.json` | `node scripts/evidence.mjs final` |
| Cover | `media/cover.png` | A screenshot of the real site |
| Demo, 19 seconds, with no captions | `media/demo.mp4` | `node scripts/record.mjs media` |
| Walkthrough, 64 seconds, with captions and no voice | `media/walkthrough.mp4` | Same |

The recordings add a dot for the pointer and captions for the viewer. These are in `scripts/record.mjs`, and they are not in the product.

Commit hashes in `results/` and in this report were updated after a file with no effect on the code was removed from git history. The source at each commit is unchanged.

The manifest for `results/final` says `dirty: true`. The earlier consumer step had rewritten `results/consumers/summary.json` when the run started. Source was clean. `bench/lib.mjs` now ignores `results/`.
