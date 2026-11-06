# Artifact manifest

Library source was last changed at `f3a4d24`. Later commits changed tests, fixtures, scripts and documentation.

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
| Demo, 20 seconds | `media/demo.mp4` | `node scripts/record.mjs media` |
| Walkthrough, 64 seconds, with captions and no voice | `media/walkthrough.mp4` | Same |

The recordings add a dot for the pointer and captions for the viewer. These are in `scripts/record.mjs`, and they are not in the product.

The manifest for `results/final` says `dirty: true`. The earlier consumer step had rewritten `results/consumers/summary.json` when the run started. Source was clean. `bench/lib.mjs` now ignores `results/`.
