import { lazy, Suspense, useEffect } from 'react';
import { useCopy } from '../lib/useCopy';
import { Stage } from './Stage';

// The gallery sits below the first screen and brings most of Base UI, so the stage goes first.
const Gallery = lazy(() => import('../gallery/Gallery').then((m) => ({ default: m.Gallery })));

const REPO = 'https://github.com/qbeka/qendrim-ui';
const REPORT = `${REPO}/blob/main/docs/REPORT.md`;
const CONTRACT = `${REPO}/blob/main/docs/CONTRACT.md`;
const INSTALL = 'npm install https://github.com/qbeka/qendrim-ui/releases/download/v0.1.0/qbeka-react-0.1.0.tgz';

/** The docs are a hash-routed page next to this one when the site is built for a sub-path. */
const docs = (path: string) =>
  import.meta.env['VITE_HASH_ROUTES'] === '1'
    ? `${import.meta.env.BASE_URL}docs/index.html#${path}`
    : `${import.meta.env.BASE_URL}${path.slice(1)}`;

const RESULTS = [
  ['Interruptions', '0 violations in 8 scenarios', 'Each scenario ran 5 times in Chromium and also passed in Firefox, WebKit and StrictMode. A careful Motion version with about 30 extra lines also scores 0, so this is a tie. Motion with height auto, Motion layout and CSS grid each fail the content growth scenarios.'],
  ['Size', 'Surface 4.1 KB, Inspector 6.7 KB', 'These are gzipped JavaScript sizes for one import, with React excluded. Motion layout is 44.1 KB. If your app already ships Motion, that cost is zero to you.'],
  ['Input response', '11.5 ms from click to first change', 'This is the median of 6 runs from rest. Motion is 11.0 to 13.2 ms and the ranges overlap, so the two are level and this is no faster.'],
  ['Layout work', '163 layouts in the reversal workload', 'That is more than any baseline, since height based Motion does 117 to 124 and Motion layout does 37.'],
  ['Budgets', '14 of 17 met', 'The budgets were frozen before the final run. Surface size, Inspector size and layout count were missed, because of fixes for real bugs. The limits were left where they were.'],
  ['Browser tests', '507 passed, three full runs in a row', 'That is 192 in Chromium, 145 in Firefox, 145 in WebKit and 25 in StrictMode.'],
  ['Mutation check', '53 of 55 deliberate defects caught', 'I judged the other 2 equivalent, from reading the code.'],
  ['Clean installs', '5 of 5 apps passed', 'The packed release passed on React 18.3.1, 19.0.0 and 19.3.1, with Vite 8 and Next 16.'],
];

const LIMITS = [
  'The package is not on npm, so the install above uses the v0.1.0 file on the GitHub release.',
  'If your app already ships Motion and one panel needs this, a measured height with Motion is about 30 lines and passes the same scenarios.',
  'All timing comes from one Apple M5 Pro Mac in headless Chromium with other work running, so this is lab data.',
  'It has not been tested on real phones, in real Safari or with a screen reader. Automated axe checks passed, and that does not establish full accessibility.',
  'Touch input has no test in the library suite.',
  'One Firefox hang during development is unexplained.',
  'Nobody outside this project has used it.',
  'The projects, people and amounts in the demo are made up. The save in the gallery is simulated.',
];

/** The page renders after the browser looks for the hash, so a link to #details lands here. */
function FollowHash() {
  useEffect(() => {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return null;
}

function CopyInstall() {
  const { state, copy } = useCopy(INSTALL);
  return (
    <button className="control outline swap" type="button" onClick={copy} data-testid="copy-install">
      <span data-on={state === 'idle' || undefined}>Copy install</span>
      <span data-on={state === 'copied' || undefined}>Copied</span>
      <span data-on={state === 'failed' || undefined}>Copy failed</span>
    </button>
  );
}

const Chevron = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function Page() {
  return (
    <div className="shell">
      <header className="topbar">
        <a className="quiet back" href="https://www.qendrimbeka.com/"><Chevron />Back</a>
        <nav aria-label="More about Qendrim UI">
          <a className="quiet" href="#details">Details</a>
          <a className="quiet" href={REPO}>GitHub</a>
        </nav>
      </header>

      <main>
        <header className="title">
          <h1>Qendrim UI</h1>
          <CopyInstall />
          <p>React components that keep up when you change your mind</p>
        </header>

        <Stage />

        <section className="install" aria-labelledby="install-title">
          <h2 id="install-title">Install</h2>
          <pre tabIndex={0} aria-label="Install command"><code>{INSTALL}</code></pre>
          <p>The package is not on npm yet, so this installs the 0.1.0 release file from GitHub. You need React 18.3 or 19, and the <a href={docs('/guide/install')}>install guide</a> covers styles and themes.</p>
        </section>

        <section className="components" id="components" aria-labelledby="components-title">
          <h2 id="components-title">Components</h2>
          <Suspense fallback={<div className="components-wait" />}>
            <Gallery docsLink={(slug, name) => <a href={docs(`/components/${slug}`)}>{name} API and keyboard map</a>} />
            <FollowHash />
          </Suspense>
          <p className="components-more"><a href={docs('/components')}>All 12 components</a></p>
        </section>

        <section className="reading" id="details" aria-labelledby="details-title">
          <h2 id="details-title">Details</h2>
          <p className="prose">Qendrim UI is a small React library for working panels that get interrupted. Each change of mind is a new request, numbered in order, and work from an older request cannot touch the newer one. A move starts from what is on screen, at the speed it is already going. The panel stays one element, so a field keeps its text, caret and selection.</p>
          <p className="prose">The panel above is the real <code>Inspector</code> running in your browser. <a href={docs('/workbench')}>The workbench</a> runs it next to Motion, CSS and deliberately broken fixtures under the same test.</p>

          <h3>Results</h3>
          <dl className="results">
            {RESULTS.map(([name, value, scope]) => <div key={name}><dt>{name}</dt><dd><b>{value}</b>{scope}</dd></div>)}
          </dl>

          <h3>Limits</h3>
          <ul className="limits">{LIMITS.map((limit) => <li key={limit}>{limit}</li>)}</ul>

          <h3>Method</h3>
          <p className="prose">The <a href={REPORT}>report</a> has every measurement with its method, raw data and failures. <a href={CONTRACT}>The contract</a> has the rules and what is not promised.</p>
        </section>

        <div className="page-end">
          <a className="quiet back" href="https://www.qendrimbeka.com/"><Chevron />Back</a>
          <a className="quiet" href={docs('/')}>Docs</a>
          <a className="quiet" href={REPO}>GitHub</a>
        </div>
      </main>
    </div>
  );
}
