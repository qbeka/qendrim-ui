#!/bin/zsh
# Clones the repository and runs the whole path from nothing. Stops at the first failure.
set -e
ROOT=${0:A:h:h}
WORK=$(mktemp -d -t qendrim-clean)
OUT=$ROOT/results/clean-checkout.txt
trap 'echo "Failed. Clone kept at $WORK" >> $OUT' ERR
{
  echo "Commit: $(git -C $ROOT rev-parse HEAD)"
  echo "Date: $(date)"
  echo "Node: $(node -v), pnpm: $(pnpm -v)"
} > $OUT
step() {
  echo "== $*" >> $OUT
  "$@" > $WORK.log 2>&1
  tail -3 $WORK.log | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-120 >> $OUT
}
git clone -q $ROOT $WORK/repo
cd $WORK/repo
step pnpm install --frozen-lockfile
step pnpm check
step pnpm test
step pnpm build
step pnpm exec playwright test --reporter=line --workers=4
step node consumers/check.mjs
step pnpm bench:smoke
echo "All steps passed." >> $OUT
