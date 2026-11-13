import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BudgetFigure, Figure, SizeFigure, SuiteFigure, TallyFigure, TimingFigure } from '../figures/Figures';
import { FIRST_EXAMPLE, INSTALL } from '../gallery/usage';
import { useCopy } from '../lib/useCopy';
import { Showpiece } from '../showpiece/Showpiece';
import { later, openGate, warm } from './idle';
import { Plates } from './Plates';
import { readSkin, skinAttributes, writeSkin, type Skin } from './skins';

// The specimen sheet and the fixture figure sit below the first screen and bring most of the
// code on the page, so each loads when it is about to be seen.
const Gallery = lazy(() => import('../gallery/Gallery').then((m) => ({ default: m.Gallery })));
const BreakFigure = lazy(() => import('../figures/BreakFigure').then((m) => ({ default: m.BreakFigure })));

const REPO = 'https://github.com/qbeka/qendrim-ui';
const REPORT = `${REPO}/blob/main/docs/REPORT.md`;
const CONTRACT = `${REPO}/blob/main/docs/CONTRACT.md`;

/** The docs are a hash-routed page in the folder next to this one when the site is built for a sub-path. */
const docs = (path: string) =>
  import.meta.env['VITE_HASH_ROUTES'] === '1'
    ? `${import.meta.env.BASE_URL}docs/#${path}`
    : `${import.meta.env.BASE_URL}${path.slice(1)}`;

const LIMITS = [
  'The package is not on npm, so the install line uses the v0.1.0 file on the GitHub release.',
  'A careful Motion version ties it on the interruption suite, and if your app already ships Motion, a measured height there is about 30 lines.',
  'Three of the 17 frozen budgets were missed, which are Surface size, Inspector size and layout count.',
  'All timing comes from one Apple M5 Pro Mac in headless Chromium with other work running, so it is lab data.',
  'It has not been tested on real phones, in real Safari or with a screen reader, and passing automated axe checks does not establish full accessibility.',
  'Touch input has no test in the library suite.',
  'Surface takes no velocity from outside, so the hold on the sheet at the top is built from ordinary requests and a drag is not part of the library.',
  'One Firefox hang during development is unexplained.',
  'Nobody outside this project has used it.',
  'The work order, the crew, the budget and the receipts on this page are made up, and the save in the crew list is simulated.',
];

const KEYS: ReadonlyArray<{ keys: string[]; does: string }> = [
  { keys: ['1', '2', '3', '4'], does: 'Send the panel to Row, Card, Editor or Sheet' },
  { keys: ['I'], does: 'Start or stop the interruptions' },
  { keys: ['Esc'], does: 'From a field, make the panel one size smaller, or put a held panel back' },
  { keys: ['Cmd or Ctrl', 'Enter'], does: 'From a field, make the panel one size larger' },
  { keys: ['[', ']'], does: 'On the budget timeline, jump to the marker before or after' },
  { keys: ['?'], does: 'Show this list' },
];

function CopyButton({ text, label, testId, className = 'control outline' }: { text: string; label: string; testId: string; className?: string }) {
  const { state, copy } = useCopy(text);
  return (
    <button className={`${className} swap`} type="button" onClick={copy} data-testid={testId} data-state={state}>
      <span data-on={state === 'idle' || undefined}>{label}</span>
      <span data-on={state === 'copied' || undefined}>Copied</span>
      <span data-on={state === 'failed' || undefined}>Copy failed</span>
    </button>
  );
}

const Chevron = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Arrow = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/**
 * Renders its children in a quiet moment after the page is in, and holds their space until then.
 * They are below the first screen, so nobody waits for them, and the first screen does not wait for their code.
 */
function Later({ children, height }: { children: ReactNode; height: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let live = true;
    later(() => {
      if (live) setShown(true);
    });
    return () => {
      live = false;
    };
  }, []);
  // What has just rendered is cold, so the browser is asked to render it too, piece by piece.
  useEffect(() => {
    if (shown) later(warm);
  }, [shown]);
  const wait = <div className="later-wait" style={{ minHeight: height }} />;
  return shown ? <Suspense fallback={wait}>{children}</Suspense> : wait;
}

/** Sections arrive as they are scrolled to. With reduced motion, or with no script, they are simply there. */
function useReveal(ready: boolean) {
  useEffect(() => {
    if (!ready || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((node) => node.getBoundingClientRect().top > window.innerHeight * 0.92);
    for (const node of nodes) node.dataset['reveal'] = 'wait';
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset['reveal'] = 'in';
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);
}

/** The page renders after the browser looks for the hash, so a link to a section lands on it. */
function useHashOnLoad(ready: boolean) {
  useEffect(() => {
    if (ready) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, [ready]);
}

/**
 * The stage is the first screen, so it renders alone. Each chapter under it then renders in a
 * task of its own, one after each frame, so that no single task holds the page up on a slow phone.
 */
function useStages(total: number) {
  // The stage itself takes its first three frames, so the chapters start after those.
  const [stage, setStage] = useState(-STAGE_FRAMES);
  useEffect(() => {
    if (stage >= total) return undefined;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setStage((current) => current + 1), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [stage, total]);
  return stage;
}

function Shortcuts({ dialog }: { dialog: React.RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog className="keys" ref={dialog} aria-labelledby="keys-title" data-testid="keys" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="keys-body">
        <header>
          <h2 id="keys-title">Keyboard</h2>
          <button type="button" className="control" onClick={() => dialog.current?.close()}>Close</button>
        </header>
        <dl>
          {KEYS.map((row) => (
            <div key={row.does}>
              <dt>{row.keys.map((key) => <kbd key={key}>{key}</kbd>)}</dt>
              <dd>{row.does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}

const STAGES = 5;
const STAGE_FRAMES = 3;

const Details = memo(function Details() {
  return (
    <section className="chapter" id="details" aria-labelledby="details-title">
      <h2 className="statement" data-block="" data-cold="" id="details-title" data-reveal="">Every change of mind is a numbered request, and the panel stays one element through all of them</h2>
      <div className="columns" data-reveal="" data-block="" data-cold="">
        <p className="prose">Qendrim UI is a small React library for working panels that get interrupted. You open one, start typing, and reverse it before it lands. Each request gets a number, and work that belongs to an older number cannot touch a newer one, so a save that finishes late does not close a panel you have reopened.</p>
        <p className="prose">A move starts from where the panel is on screen, at the speed it is already going, which is why the paths on the sheet above stay smooth when you interrupt it. Nothing is copied or moved to a new parent, so a field keeps its text, its caret and its selection, and focus moves when you ask for it and not when the animation ends.</p>
      </div>

      <div className="passage" data-reveal="" data-block="" data-cold="">
        <h3 className="lead">What happens when a panel is not one element</h3>
        <p className="prose">The quickest ways to animate a panel are to scale its content, or to show a copy of it while the real one changes. Both look right until someone reverses the move or is typing in it. The test suite keeps one panel of each kind, broken on purpose, to prove that its detector can see the fault. Here they are beside the library, read by that same detector.</p>
      </div>
      <div data-reveal="">
        <Figure id="figure-break" label="Figure 1" wide caption="Both panels get the same clicks, and the lines under them come from the recorder and the detector that the browser tests use">
          <Later height={520}><BreakFigure /></Later>
        </Figure>
      </div>
      <p className="prose passage" data-reveal="" data-block="" data-cold="">A panel that is broken on purpose is an easy opponent. The fair comparison is further down, against Motion and plain CSS written with care, and it ends in a tie.</p>
    </section>
  );
});

const Components = memo(function Components({ skin, onSkin }: { skin: Skin; onSkin: (skin: Skin, done?: () => void) => void }) {
  return (
    <section className="chapter" id="components" aria-labelledby="components-title">
      <div className="section-head" data-reveal="" data-block="" data-cold="">
        <h2 id="components-title">Twelve components, and the page they are printed on</h2>
      </div>
      <p className="prose lead-in" data-reveal="" data-block="" data-cold="">Four are this library's own and eight are Base UI primitives with styles. Each plate below changes the tokens for this whole page.</p>

      <Plates skin={skin} onSkin={onSkin} />
      <div className="skin-code">
        <pre tabIndex={0} aria-label="Attributes for this recipe and theme" data-testid="skin-code"><code>{skinAttributes(skin)}</code></pre>
        <CopyButton text={skinAttributes(skin)} label="Copy" testId="copy-skin" />
      </div>

      <div data-reveal="" data-testid="sheet">
        <Later height={1500}><Gallery docsLink={(slug, name) => <a href={docs(`/components/${slug}`)}>{name} API and keyboard map</a>} /></Later>
      </div>
      <p className="more"><a href={docs('/components')}>All 12 components</a> and <a href={docs('/guide/theming')}>the token list</a> are in the docs</p>
    </section>
  );
});

const Start = memo(function Start() {
  return (
    <section className="chapter" id="start" aria-labelledby="start-title">
      <div className="section-head" data-reveal="" data-block="" data-cold="">
        <h2 id="start-title">Start</h2>
      </div>
      <p className="prose lead-in" data-reveal="" data-block="" data-cold="">The package is not on npm, so the first line installs the 0.1.0 release file from GitHub. It needs React 18.3 or 19.</p>
      <ol className="steps" data-reveal="" data-block="" data-cold="">
        <li>
          <div className="step-head"><span>Install it</span><CopyButton text={INSTALL} label="Copy" testId="copy-install-step" className="control" /></div>
          <pre tabIndex={0} aria-label="Install command" data-testid="install-command"><code>{INSTALL}</code></pre>
        </li>
        <li>
          <div className="step-head"><span>Paste a first panel</span><CopyButton text={FIRST_EXAMPLE} label="Copy" testId="copy-example" className="control" /></div>
          <pre tabIndex={0} aria-label="First example" data-testid="first-example"><code>{FIRST_EXAMPLE}</code></pre>
        </li>
      </ol>
      <p className="more">An import downloads no fonts, installs no reset and needs no provider, and <a href={docs('/guide/install')}>the install guide</a> covers styles, layers and themes</p>
    </section>
  );
});

const Measured = memo(function Measured() {
  return (
    <section className="chapter" id="measured" aria-labelledby="measured-title">
      <h2 className="statement" data-block="" data-cold="" id="measured-title" data-reveal="">A careful Motion version ties it on correctness, so what this adds is a written contract and a smaller download</h2>
      <div className="columns" data-reveal="" data-block="" data-cold="">
        <p className="prose">The comparison suite runs 8 interruption scenarios, 5 times each, against five implementations of one panel in Chromium. The plain rules for focus, removal and a late close were given to every baseline, so that the comparison is about geometry.</p>
        <p className="prose">Everything below was measured on the library source on 6 November 2026, on one Apple M5 Pro Mac in headless Chromium with other work running. It is lab data, and <a href={REPORT}>the report</a> has the method, the raw samples and the failures.</p>
      </div>

      <div data-reveal="">
        <Figure id="figure-suite" label="Figure 2" wide caption="Each mark is one run and a filled square is a run with a violation, on one panel shape in one layout, where Surface and the measured Motion version were both clean in all 40">
          <SuiteFigure />
        </Figure>
      </div>
      <p className="prose passage" data-reveal="" data-block="" data-cold="">The measured Motion version is about 30 lines longer than the obvious one. If your app already ships Motion and one panel needs this, that is the better choice. Where Motion is not already on the page, the difference is the download.</p>

      <div data-reveal="">
        <Figure id="figure-size" label="Figure 3" caption="Gzipped JavaScript for one import with React excluded, bundled by esbuild from the packed release, and if your app already ships Motion that cost is zero to you">
          <SizeFigure />
        </Figure>
      </div>
      <div data-reveal="">
        <Figure id="figure-timing" label="Figure 4" wide caption="Median and range of 6 runs, where the ranges of Surface and the Motion versions overlap, so it is level and no faster, and Surface does more layouts than any baseline">
          <TimingFigure />
        </Figure>
      </div>

      <div className="passage" data-reveal="" data-block="" data-cold="">
        <h3 className="lead">Fourteen budgets met and three missed</h3>
        <p className="prose">The budgets were frozen before the final run. A later review found that the engine jumped for any box not anchored at its top left corner, and the fix needs a second read of the layout at each request. That is where the extra bytes and the extra layouts came from. The limits were left where they were.</p>
      </div>
      <div data-reveal="">
        <Figure id="figure-budgets" label="Figure 5" wide caption="Each bar is a measurement against its own limit, which is the line, so a bar that crosses the line is a miss">
          <BudgetFigure />
        </Figure>
      </div>
      <div data-reveal="">
        <Figure id="figure-tallies" label="Figure 6" wide caption="The suite itself was checked by breaking the library on purpose, one defect at a time, and the packed release was installed into clean apps">
          <TallyFigure />
        </Figure>
      </div>
    </section>
  );
});

const Limits = memo(function Limits() {
  return (
    <section className="chapter" id="limits" aria-labelledby="limits-title">
      <div className="section-head" data-reveal="" data-block="" data-cold="">
        <h2 id="limits-title">Limits</h2>
      </div>
      <ol className="limits" data-reveal="" data-block="" data-cold="">{LIMITS.map((limit) => <li key={limit}>{limit}</li>)}</ol>
    </section>
  );
});

const Ending = memo(function Ending() {
  return (
    <section className="ending" aria-labelledby="ending-title">
      <h2 className="statement" data-block="" data-cold="" id="ending-title" data-reveal="">Read how it was measured, or go back up and try to break it</h2>
      <ul className="doors" data-reveal="" data-block="" data-cold="">
        <li><a href={docs('/')}><b>Docs</b><span>All 12 components, the guides and two working apps</span><Arrow /></a></li>
        <li><a href={docs('/workbench')}><b>Workbench</b><span>The library next to Motion, CSS and broken fixtures under one test</span><Arrow /></a></li>
        <li><a href={REPORT}><b>Report</b><span>Every measurement with its method, raw data and failures</span><Arrow /></a></li>
        <li><a href={CONTRACT}><b>Contract</b><span>The rules a panel keeps, and what is not promised</span><Arrow /></a></li>
        <li><a href={REPO}><b>GitHub</b><span>The source, the test suite and the recorded runs</span><Arrow /></a></li>
      </ul>
    </section>
  );
});

/** Back goes to the work row, or to the story that linked here with ?from=<its slug>. */
const BACK = (() => {
  const from = new URLSearchParams(window.location.search).get('from');
  return from && /^[a-z0-9-]+$/.test(from) ? `/work/${from}` : '/#work-qendrim-ui';
})();

export function Page() {
  const [skin, setSkin] = useState<Skin>(() => readSkin(window.location.search));
  const keys = useRef<HTMLDialogElement>(null);
  const stage = useStages(STAGES);
  useReveal(stage >= STAGES);
  useHashOnLoad(stage >= STAGES);

  // Once the page is in, what is below the first screen loads and renders in the quiet moments.
  useEffect(() => {
    if (stage < STAGES) return;
    openGate();
    later(warm);
  }, [stage]);

  const openKeys = useCallback(() => {
    if (!keys.current?.open) keys.current?.showModal();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text') || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      openKeys();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKeys]);

  /*
   * The whole page takes the recipe and the theme, and the address remembers anything but the
   * default. A theme is color, which the browser can change everywhere at once. A recipe is
   * type and shape, which costs a layout, so it is given to one part of the page on each frame,
   * from the top down, and to the root last. No one frame is long, and all of it happens
   * behind the plate, which goes home when `done` is called.
   */
  const wanted = useRef(skin);
  const applySkin = useCallback((next: Skin, done?: () => void) => {
    wanted.current = next;
    const root = document.documentElement;
    root.dataset['qTheme'] = next.theme;
    const finish = () => {
      const latest = wanted.current;
      const search = writeSkin(latest, window.location.search);
      if (search !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
      setSkin(latest);
      done?.();
    };
    if (root.dataset['qRecipe'] === next.recipe) {
      window.setTimeout(finish, 0);
      return;
    }
    const parts = [...document.querySelectorAll<HTMLElement>('.topbar, main > *')];
    let index = 0;
    const step = () => {
      const { recipe, theme } = wanted.current;
      const part = parts[index];
      index += 1;
      if (part) {
        // The theme goes with it, so that a scope of its own never falls back to the system's.
        part.dataset['qRecipe'] = recipe;
        part.dataset['qTheme'] = theme;
        requestAnimationFrame(step);
        return;
      }
      root.dataset['qRecipe'] = recipe;
      for (const each of parts) {
        delete each.dataset['qRecipe'];
        delete each.dataset['qTheme'];
      }
      window.setTimeout(finish, 0);
    };
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['qRecipe'] = skin.recipe;
    root.dataset['qTheme'] = skin.theme;
    // Only on load. After that applySkin writes them at the moment the plate covers the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <a className="quiet back" href={BACK}><Chevron />Back</a>
        <nav aria-label="More about Qendrim UI">
          <a className="quiet" href="#details">Details</a>
          <a className="quiet" href={REPO}>GitHub</a>
        </nav>
      </header>

      <main>
        <header className="title">
          <h1>Qendrim UI</h1>
          <CopyButton text={INSTALL} label="Copy install" testId="copy-install" />
        </header>

        <Showpiece linked onHelp={openKeys} />

        {stage >= 1 ? <Details /> : null}
        {stage >= 2 ? <Components skin={skin} onSkin={applySkin} /> : null}
        {stage >= 3 ? <Start /> : null}
        {stage >= 4 ? <Measured /> : null}
        {stage >= 5 ? <><Limits /><Ending /></> : null}

        <div className="page-end" hidden={stage < STAGES}>
          <a className="quiet back" href={BACK}><Chevron />Back</a>
          <button type="button" className="quiet" onClick={() => window.scrollTo({ top: 0 })}>Back to the sheet</button>
          <button type="button" className="quiet" onClick={openKeys}>Keyboard</button>
        </div>
      </main>
      <Shortcuts dialog={keys} />
    </div>
  );
}
