import { HAIRLINE } from './hairline';
import { Replay } from './Replay';

const REPO = 'https://github.com/qbeka/qendrim-ui';
const REPORT = `${REPO}/blob/main/docs/REPORT.md`;

/** The docs are a hash-routed page next to this one when the site is built for a sub-path. */
const docs = (path: string) =>
  import.meta.env['VITE_HASH_ROUTES'] === '1'
    ? `${import.meta.env.BASE_URL}docs/index.html#${path}`
    : `${import.meta.env.BASE_URL}${path.slice(1)}`;

const STATS = [
  { value: '0', label: 'violations across 8 interruption scenarios, in 4 browser setups' },
  { value: '4.1 KB', label: 'Surface, gzipped. Motion layout is 44.1 KB' },
  { value: '11.5 ms', label: 'click to first change, level with Motion' },
  { value: '53 of 55', label: 'deliberate bugs caught. The other 2 changed no behavior' },
];

const RESULTS = [
  ['Interruptions', 'No violations in 8 scenarios in Chromium, Firefox, WebKit and StrictMode. A careful Motion version with about 30 extra lines also scores 0, so this is what the library does, not something only it can do.'],
  ['Cost', 'Surface is 4.1 KB gzipped with no other dependency. Inspector is 6.7 KB. Foundation components add at most 418 bytes over Base UI directly.'],
  ['Timing', 'Level with Motion: 11.5 ms from click to first change, against 11.0 to 13.2 ms. It does more layouts, 163 against 117 to 124 in the same workload.'],
  ['Budgets', '14 of 17 frozen budgets met. Surface size, Inspector size and layout count were missed, by fixes for real bugs. The limits were left where they were.'],
];

const VERIFIED = [
  ['Browser tests', '507 passed across Chromium, Firefox, WebKit and StrictMode, in three full runs in a row. 94 more are skipped by design.'],
  ['Clean installs', 'The packed release passes in 5 clean apps, on React 18.3.1, 19.0.0 and 19.3.1, with Vite 8 and Next 16.'],
  ['Broken on purpose', 'Seeded broken fixtures are caught by the same detectors that clear the library.'],
  ['Limits', 'Measured on one Mac in headless Chromium with other work running. No real phones, real Safari or screen readers were tested, and nobody outside this project has used it.'],
];

export function Page() {
  return (
    <div className="p-site">
      <svg className="p-hairline" viewBox="0 0 640 56" preserveAspectRatio="none" aria-hidden><path d={HAIRLINE} /></svg>
      <div className="p-page">
        <header>
          <h1>Qendrim UI</h1>
          <p className="p-subtitle">React components for panels that keep working when you change your mind. Reverse one, resize it or refill it mid-move, and your text, focus and place stay put.</p>
          <div className="p-pills">
            <a className="p-pill p-dark" href="#replay">Watch the replay</a>
            <a className="p-pill" href={docs('/')}>Open the docs</a>
            <a className="p-pill" href={REPO}>GitHub</a>
          </div>
          <p className="p-verdict">A careful version built on Motion scored the same on correctness. What this adds is that contract as a small, tested package.</p>
          <div className="p-stats">
            {STATS.map((stat) => (
              <div className="p-stat" key={stat.value}>
                <div className="p-stat-value">{stat.value}</div>
                <div className="p-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </header>
        <main>
          <section aria-labelledby="idea">
            <h2 id="idea">The idea</h2>
            <p>Most panels animate well until someone interrupts them. Click twice and the content jumps. Reverse a move and a late animation finishes the wrong one. Type while it opens and the field loses your caret.</p>
            <p>This library treats each change of mind as a new request, numbered in order. Work from an older request cannot touch the newer one.</p>
            <ul className="p-dashes">
              <li>The newest request wins, even when a slow save finishes late.</li>
              <li>A move starts from what is on screen, at the speed it is already going.</li>
              <li>The panel is one element, so fields keep their text, caret and selection.</li>
            </ul>
          </section>
          <section id="replay" aria-labelledby="replay-title">
            <h2 id="replay-title">One panel, interrupted seven ways</h2>
            <Replay />
          </section>
          <section aria-labelledby="results-title">
            <h2 id="results-title">Results</h2>
            <ul className="p-rows">
              {RESULTS.map(([name, text]) => <li key={name}><strong>{name}</strong><p>{text}</p></li>)}
            </ul>
          </section>
          <section aria-labelledby="verified">
            <h2 id="verified">How it is verified</h2>
            <ul className="p-rows">
              {VERIFIED.map(([name, text]) => <li key={name}><strong>{name}</strong><p>{text}</p></li>)}
            </ul>
          </section>
          <section aria-labelledby="go">
            <h2 id="go">Go further</h2>
            <ul className="p-rows">
              <li><strong><a href={docs('/')}>Docs</a></strong><p>Components, live examples, API tables and keyboard maps.</p></li>
              <li><strong><a href={docs('/workbench')}>Workbench</a></strong><p>This library next to Motion, CSS and deliberately broken fixtures, under the same test.</p></li>
              <li><strong><a href={REPORT}>Report</a></strong><p>Every measurement, with its method and its limits.</p></li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
