import { Scope, type Recipe, type Theme } from '@qbeka/react/scope';
import { lazy, Suspense, useEffect, useState } from 'react';
import { FIRST_EXAMPLE, INSTALL } from '../gallery/usage';
import { useCopy } from '../lib/useCopy';
import { Showpiece } from '../showpiece/Showpiece';

// The specimen sheet sits below the first screen and brings most of Base UI, so the stage goes first.
const Gallery = lazy(() => import('../gallery/Gallery').then((m) => ({ default: m.Gallery })));

const REPO = 'https://github.com/qbeka/qendrim-ui';
const REPORT = `${REPO}/blob/main/docs/REPORT.md`;
const CONTRACT = `${REPO}/blob/main/docs/CONTRACT.md`;

/** The docs are a hash-routed page in the folder next to this one when the site is built for a sub-path. */
const docs = (path: string) =>
  import.meta.env['VITE_HASH_ROUTES'] === '1'
    ? `${import.meta.env.BASE_URL}docs/#${path}`
    : `${import.meta.env.BASE_URL}${path.slice(1)}`;

const SKINS: ReadonlyArray<{ id: string; recipe: Recipe; theme: Theme; name: string; tone: string; text: string }> = [
  { id: 'studio-light', recipe: 'studio', theme: 'light', name: 'Studio', tone: 'Light', text: 'Dense tools' },
  { id: 'studio-dark', recipe: 'studio', theme: 'dark', name: 'Studio', tone: 'Dark', text: 'Dense tools' },
  { id: 'editorial-light', recipe: 'editorial', theme: 'light', name: 'Editorial', tone: 'Light', text: 'Reading pages' },
  { id: 'editorial-dark', recipe: 'editorial', theme: 'dark', name: 'Editorial', tone: 'Dark', text: 'Reading pages' },
];

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
  'The work order, the crew, the budget and the receipts on this page are made up, and the save in the crew list is simulated.',
];

/** The page renders after the browser looks for the hash, so a link to #details lands here. */
function FollowHash() {
  useEffect(() => {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return null;
}

function CopyButton({ text, label, testId, className = 'control outline' }: { text: string; label: string; testId: string; className?: string }) {
  const { state, copy } = useCopy(text);
  return (
    <button className={`${className} swap`} type="button" onClick={copy} data-testid={testId}>
      <span data-on={state === 'idle' || undefined}>{label}</span>
      <span data-on={state === 'copied' || undefined}>Copied</span>
      <span data-on={state === 'failed' || undefined}>Copy failed</span>
    </button>
  );
}

const Chevron = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function Components() {
  const [skin, setSkin] = useState(SKINS[0] as (typeof SKINS)[number]);
  const attributes = `<html data-q-recipe="${skin.recipe}" data-q-theme="${skin.theme}">`;
  return (
    <section className="components" id="components" aria-labelledby="components-title">
      <div className="section-head">
        <h2 id="components-title">Components</h2>
        <p>Four are this library's own and eight are Base UI primitives with styles, and two recipes in light and dark change tokens only</p>
      </div>

      <div className="skins" role="group" aria-label="Recipe and theme">
        {SKINS.map((item) => (
          <button key={item.id} type="button" className="skin" aria-pressed={skin.id === item.id} onClick={() => setSkin(item)} data-testid={`skin-${item.id}`} data-q-recipe={item.recipe} data-q-theme={item.theme}>
            <span className="skin-name"><b>{item.name}</b> {item.tone}</span>
            <span className="skin-letters" aria-hidden="true">Aa</span>
            <span className="skin-row" aria-hidden="true">
              <span className="skin-button">Save</span>
              <span className="skin-ghost">Cancel</span>
            </span>
            <span className="skin-text">{item.text}</span>
          </button>
        ))}
      </div>
      <div className="skin-code">
        <pre tabIndex={0} aria-label="Attributes for this recipe and theme" data-testid="skin-code"><code>{attributes}</code></pre>
        <CopyButton text={attributes} label="Copy" testId="copy-skin" />
      </div>

      <Suspense fallback={<div className="components-wait" />}>
        <Scope recipe={skin.recipe} theme={skin.theme} className="sheet-scope" data-testid="sheet">
          <Gallery docsLink={(slug, name) => <a href={docs(`/components/${slug}`)}>{name} API and keyboard map</a>} />
        </Scope>
        <FollowHash />
      </Suspense>
      <p className="components-more"><a href={docs('/components')}>All 12 components</a> and <a href={docs('/guide/theming')}>the token list</a> are in the docs</p>
    </section>
  );
}

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
          <CopyButton text={INSTALL} label="Copy install" testId="copy-install" />
          <p>React components that keep up when you change your mind</p>
        </header>

        <Showpiece linked />

        <section className="start" id="start" aria-labelledby="start-title">
          <div className="section-head">
            <h2 id="start-title">Start</h2>
            <p>The package is not on npm, so the first line installs the 0.1.0 release file from GitHub, and it needs React 18.3 or 19</p>
          </div>
          <ol className="steps">
            <li>
              <div className="step-head"><span>Install it</span><CopyButton text={INSTALL} label="Copy" testId="copy-install-step" className="control" /></div>
              <pre tabIndex={0} aria-label="Install command" data-testid="install-command"><code>{INSTALL}</code></pre>
            </li>
            <li>
              <div className="step-head"><span>Paste a first panel</span><CopyButton text={FIRST_EXAMPLE} label="Copy" testId="copy-example" className="control" /></div>
              <pre tabIndex={0} aria-label="First example" data-testid="first-example"><code>{FIRST_EXAMPLE}</code></pre>
            </li>
          </ol>
          <p className="start-more">An import downloads no fonts, installs no reset and needs no provider, and <a href={docs('/guide/install')}>the install guide</a> covers styles, layers and themes</p>
        </section>

        <Components />

        <section className="reading" id="details" aria-labelledby="details-title">
          <h2 id="details-title">Details</h2>
          <p className="prose">Qendrim UI is a small React library for working panels that get interrupted. Each change of mind is a new request, numbered in order, and work from an older request cannot touch the newer one. A move starts from what is on screen, at the speed it is already going. The panel stays one element, so a field keeps its text, caret and selection.</p>
          <p className="prose">The work order at the top is one <code>Surface</code> running in your browser, and its four layouts are plain CSS. The outlines it leaves behind are its measured box, a few frames apart. <a href={docs('/workbench')}>The workbench</a> runs the library next to Motion, CSS and deliberately broken fixtures under the same test.</p>

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
