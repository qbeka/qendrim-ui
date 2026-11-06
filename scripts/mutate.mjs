// Mutation check. Applies one deliberate defect at a time in a separate clone and runs the
// tests. A surviving mutant is a gap in the tests. The unmodified code runs first in the
// same sandbox: a mutant only counts as caught if the control passes there, and each kill
// records which test failed and why, so a sandbox failure cannot pass for a catch.
//   node scripts/mutate.mjs [--only id]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SANDBOX = process.env.MUTATE_DIR ?? join(tmpdir(), 'qendrim-mutants');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const outName = only ? 'partial.json' : 'summary.json';
const PORT = '5187';

const CORE = 'packages/react/src/core';
const SPECS = ['e2e/interruption.spec.ts', 'e2e/inspector.spec.ts', 'e2e/geometry.spec.ts', 'e2e/components.spec.ts'];

const MUTANTS = [
  ['stale-completion-commits', `${CORE}/machine.ts`, "if (claimed !== generation) return 'stale';", ''],
  ['repeat-request-advances', `${CORE}/machine.ts`, 'if (destroyed || shape === desired) return false;', 'if (destroyed) return false;'],
  ['destroy-does-not-stop-requests', `${CORE}/machine.ts`, 'if (destroyed || shape === desired) return false;', 'if (shape === desired) return false;'],
  ['token-ignores-newer-intent', `${CORE}/machine.ts`, 'isCurrent: (token) => !destroyed && token.generation === generation,', 'isCurrent: () => !destroyed,'],
  ['retarget-drops-velocity', `${CORE}/engine.ts`, "begin(from, velocity, to, 'shape');", "begin(from, ZERO, to, 'shape');"],
  ['retarget-starts-from-target', `${CORE}/engine.ts`, 'height: visible.height,\n      radius: visible.radius,\n    };\n    const to', 'height: target.height,\n      radius: visible.radius,\n    };\n    const to'],
  ['position-not-held', `${CORE}/engine.ts`, 'dy: visible.y - target.y,', 'dy: 0,'],
  ['destroy-leaves-loop-running', `${CORE}/engine.ts`, "destroyed = true;\n      stopLoop();", 'destroyed = true;'],
  ['destroy-leaves-inline-styles', `${CORE}/engine.ts`, "stopLoop();\n      segments = null;\n      port.release();\n      onTrace?.({ type: 'destroy'", "stopLoop();\n      segments = null;\n      onTrace?.({ type: 'destroy'"],
  ['no-end-correction', `${CORE}/engine.ts`, 'const MAX_CORRECTIONS = 2;', 'const MAX_CORRECTIONS = 0;'],
  ['viewport-change-ignored', `${CORE}/engine.ts`, 'if (segments && !heightOnly) viewportDirty = true;', ''],
  ['content-growth-not-animated', `${CORE}/engine.ts`, 'if (port.prefersReducedMotion() || port.isDocumentHidden()) return;\n\n      const { values', 'return;\n\n      const { values'],
  ['growth-in-flight-ignored', `${CORE}/engine.ts`, "begin(values, velocity, to, 'content');\n        }\n        return;", '}\n        return;'],
  ['reduced-motion-ignored', `${CORE}/engine.ts`, "if (port.prefersReducedMotion()) return 'reduced-motion' as const;", ''],
  ['rotation-ignored', `${CORE}/engine.ts`, "if (target.unsupportedTransform) return 'unsupported-transform' as const;", ''],
  ['stale-action-runs', `${CORE}/engine.ts`, 'if (machine.isCurrent(token)) {', 'if (machine.snapshot()) {'],
  ['scroll-not-restored', `${CORE}/dom-port.ts`, 'pendingScroll = readScrollPositions(root);\n      const rect', 'const rect'],
  ['ancestor-scale-ignored', `${CORE}/dom-port.ts`, 'scaleX *= matrix.a;\n    scaleY *= matrix.d;', ''],
  ['content-width-not-locked', `${CORE}/dom-port.ts`, 'content.style.width = `${width}px`;', ''],
  ['focus-ignores-inert', `${CORE}/focus.ts`, "if (element.closest('[inert]')) return false;", ''],
  ['capture-skipped', 'packages/react/src/surface/Surface.tsx', 'if (previous.shape !== this.props.shape) this.props.capture();', ''],
  ['observer-not-disconnected', 'packages/react/src/surface/Surface.tsx', 'observer.disconnect();', ''],
  ['resize-listener-not-removed', 'packages/react/src/surface/Surface.tsx', "window.removeEventListener('resize', onViewportChange);", ''],
  ['close-does-not-move-focus', 'packages/react/src/inspector/Inspector.tsx', "if (panel.contains(active)) traceFocus('close', [triggerRef.current, latest.current.fallbackFocusRef?.current, rootRef.current]);", ''],
  ['closing-panel-not-inert', 'packages/react/src/inspector/Inspector.tsx', "panel.setAttribute('inert', '');", ''],
  ['reopen-forgets-field', 'packages/react/src/inspector/Inspector.tsx', 'const remembered = lastFocused.current;', 'const remembered = null;'],
  ['typing-does-not-cancel-close', 'packages/react/src/inspector/Inspector.tsx', 'if (pendingToken.current) {\n      handleRef.current?.invalidate();', 'if (false) {\n      handleRef.current?.invalidate();'],
  ['removal-does-not-recover-focus', 'packages/react/src/inspector/Inspector.tsx', "traceFocus('recover', [latest.current.fallbackFocusRef?.current, root.ownerDocument.body]);", ''],
  ['modal-never-unmounts', 'packages/react/src/inspector/ModalInspector.tsx', 'onClosedSettle: () => actionsRef.current?.unmount()', 'onClosedSettle: () => undefined'],
  ['actionbar-keeps-focus', 'packages/react/src/actionbar/ActionBar.tsx', 'moveFocus([fallbackFocusRef?.current]);', ''],
  ['actionbar-takes-space', 'packages/react/src/css/actionbar.css', 'inset-block-end: var(--q-space-4);\n    z-index: var(--q-layer-sheet);\n    block-size: 0;', 'inset-block-end: var(--q-space-4);\n    z-index: var(--q-layer-sheet);\n    block-size: 4rem;'],
  ['closed-panel-reachable', 'packages/react/src/css/inspector.css', "[data-phase='settled'] .q-inspector-panel {\n    visibility: hidden;\n  }", "[data-phase='settled'] .q-inspector-panel {\n  }"],
];

const sh = (cmd, args, cwd, env = {}) => spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 2 ** 27 });

function prepare() {
  if (!existsSync(SANDBOX)) {
    execFileSync('git', ['clone', '-q', ROOT, SANDBOX]);
  } else {
    execFileSync('git', ['fetch', '-q', 'origin'], { cwd: SANDBOX });
  }
  execFileSync('git', ['checkout', '-q', execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()], { cwd: SANDBOX });
  sh('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], SANDBOX);
}

function suite() {
  const unit = sh('pnpm', ['exec', 'vitest', 'run'], SANDBOX);
  const build = sh('pnpm', ['--filter', 'docs', 'build'], SANDBOX);
  if (build.status !== 0) return { outcome: 'build-failed', reason: build.stdout.slice(-400) };
  const e2e = sh('pnpm', ['exec', 'playwright', 'test', '--project=chromium', '--reporter=line', '--workers=3', ...SPECS], SANDBOX, { E2E_PORT: PORT });
  // Vitest writes failures to stderr, and the output has color codes in it.
  const unitText = `${unit.stdout}\n${unit.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
  const failedUnit = [...unitText.matchAll(/FAIL\s+(.+)/g)].map((m) => m[1].trim());
  const failedE2e = [...e2e.stdout.matchAll(/^\s+\d+\) \[chromium\] › (.+?)\s*─*\s*$/gm)].map((m) => m[1].trim());
  return { unitStatus: unit.status, e2eStatus: e2e.status, failedUnit: [...new Set(failedUnit)], failedE2e: [...new Set(failedE2e)] };
}

prepare();
console.log(`Sandbox ready at ${SANDBOX}`);

const control = suite();
console.log('Control', JSON.stringify(control));
const controlClean = control.unitStatus === 0 && control.e2eStatus === 0;

const results = [];
for (const [id, file, find, replace] of MUTANTS) {
  if (only && !only.includes(id)) continue;
  const path = join(SANDBOX, file);
  const original = readFileSync(path, 'utf8');
  if (!original.includes(find)) {
    results.push({ id, file, outcome: 'not-applied' });
    console.log(`${id}: NOT APPLIED`);
    continue;
  }
  writeFileSync(path, original.replace(find, replace));
  const result = suite();
  writeFileSync(path, original);
  // Exit codes decide. A nonzero exit with no parsed test name is reported, not assumed.
  const caught = (result.failedUnit?.length ?? 0) + (result.failedE2e?.length ?? 0) > 0;
  if (!caught && (result.unitStatus !== 0 || result.e2eStatus !== 0)) result.outcome = 'failed-without-a-named-test';
  results.push({ id, file, outcome: result.outcome ?? (caught ? 'caught' : 'survived'), ...result });
  console.log(`${id}: ${caught ? 'caught' : 'SURVIVED'} (${result.failedUnit?.length ?? 0} unit, ${result.failedE2e?.length ?? 0} browser)`);
}

const summary = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SANDBOX, encoding: 'utf8' }).trim(),
  date: new Date().toISOString(),
  controlClean,
  control,
  total: results.length,
  caught: results.filter((r) => r.outcome === 'caught').length,
  survived: results.filter((r) => r.outcome === 'survived').map((r) => r.id),
  notApplied: results.filter((r) => r.outcome === 'not-applied').map((r) => r.id),
  results,
};
mkdirSync(join(ROOT, 'results/mutation'), { recursive: true });
writeFileSync(join(ROOT, 'results/mutation', outName), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`${summary.caught} of ${summary.total} caught. Control clean: ${controlClean}. Survived: ${summary.survived.join(', ') || 'none'}.`);
