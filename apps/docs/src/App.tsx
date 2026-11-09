import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NAV, neighbors, pageLabel } from './docs/nav';
import { Link, usePath } from './lib/router';
import { ComponentIndex, ComponentPage, GuidePage, NotFound } from './pages/Docs';
import { Evidence } from './pages/Evidence';
import { Home } from './pages/Home';
import { ProjectsApp } from './examples/ProjectsApp';
import { ReceiptsApp } from './examples/ReceiptsApp';
import './site.css';

const Fixture = lazy(() => import('./pages/Fixture').then((m) => ({ default: m.Fixture })));
const Workbench = lazy(() => import('./pages/Workbench').then((m) => ({ default: m.Workbench })));
const FoundationCompare = lazy(() => import('./pages/FoundationCompare').then((m) => ({ default: m.FoundationCompare })));
const SpecialFixtures = lazy(() => import('./pages/SpecialFixtures').then((m) => ({ default: m.SpecialFixtures })));

type Theme = 'system' | 'light' | 'dark';
type Recipe = 'studio' | 'editorial';

const REPO = 'https://github.com/qbeka/qendrim-ui';
const RECIPES: ReadonlyArray<{ value: Recipe; label: string }> = [{ value: 'studio', label: 'Studio' }, { value: 'editorial', label: 'Editorial' }];
const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }];

/** Built for a sub-path, the docs sit in a folder under the project page. Otherwise it is a route here. */
const PROJECT_PAGE = import.meta.env['VITE_HASH_ROUTES'] === '1' ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}project/`;

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function usePreference<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be blocked. The choice then lasts for this page view.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function Route({ path }: { path: string }) {
  if (path === '/') return <Home />;
  if (path === '/examples/projects') return <div className="d-wide"><ExampleHead title="Project inspector" text="A working editor with save, failure, undo and diagnostics, where every row is one Inspector" /><ProjectsApp /></div>;
  if (path === '/examples/receipts') return <div className="d-wide"><ExampleHead title="Receipt review" text="A modal review, a timeline and contextual actions, sharing one month of receipts" /><ReceiptsApp /></div>;
  if (path === '/workbench') return <Workbench />;
  if (path === '/evidence') return <Evidence />;
  if (path === '/components') return <ComponentIndex />;
  const component = path.match(/^\/components\/([a-z]+)$/);
  if (component?.[1]) return <ComponentPage slug={component[1]} />;
  const guide = path.match(/^\/guide\/([a-z-]+)$/);
  if (guide?.[1]) return <GuidePage slug={guide[1]} />;
  return <NotFound />;
}

/** The example apps bring their own h1, so this is a line above them and not a heading. */
function ExampleHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="d-example-head">
      <p className="d-crumb">Examples, {title.toLowerCase()}</p>
      <p className="d-note">{text}</p>
    </div>
  );
}

const isWide = (path: string) => path === '/' || path === '/components' || path === '/workbench' || path === '/evidence' || path.startsWith('/examples/');

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="d-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className="d-seg-button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} data-testid={`pref-${option.value}`}>{option.label}</button>
      ))}
    </div>
  );
}

function SiteNav({ path, label }: { path: string; label: string }) {
  return (
    <nav className="d-nav" aria-label={label}>
      {NAV.map((group) => (
        <div className="d-nav-group" key={group.title}>
          <p>{group.title}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.to}><Link to={item.to} aria-current={path === item.to ? 'page' : undefined}>{item.label}</Link></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Pager({ path }: { path: string }) {
  const { previous, next } = neighbors(path);
  if (!previous && !next) return null;
  return (
    <nav className="d-pager" aria-label="Previous and next page">
      {previous ? <Link to={previous.to} className="d-pager-link"><span>Previous</span>{previous.label}</Link> : <span />}
      {next ? <Link to={next.to} className="d-pager-link d-pager-next"><span>Next</span>{next.label}</Link> : <span />}
    </nav>
  );
}

export function App() {
  const path = usePath();
  const [theme, setTheme] = usePreference<Theme>('q-docs-theme', 'system');
  const [recipe, setRecipe] = usePreference<Recipe>('q-docs-recipe', 'studio');
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['qRecipe'] = recipe;
    if (theme === 'system') delete root.dataset['qTheme'];
    else root.dataset['qTheme'] = theme;
  }, [theme, recipe]);

  useEffect(() => {
    document.title = path === '/' ? 'Qendrim UI' : `${pageLabel(path) ?? path.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ')} · Qendrim UI`;
    if (menu.current) menu.current.open = false;
  }, [path]);

  if (path === '/fixture') return <Suspense fallback={null}><Fixture /></Suspense>;
  if (path === '/fixture/foundation') return <Suspense fallback={null}><FoundationCompare /></Suspense>;
  if (path === '/fixture/special') return <Suspense fallback={null}><SpecialFixtures /></Suspense>;

  const prefs = (
    <div className="d-prefs">
      <Segmented label="Recipe" value={recipe} options={RECIPES} onChange={setRecipe} />
      <Segmented label="Theme" value={theme} options={THEMES} onChange={setTheme} />
    </div>
  );

  return (
    <div className="d-site">
      <a className="d-skip" href="#main">Skip to content</a>
      <header className="d-top">
        <Link to="/" className="d-mark">Qendrim UI<span>0.1.0</span></Link>
        <div className="d-top-end">
          <div className="d-top-prefs">{prefs}</div>
          <a className="d-quiet" href={PROJECT_PAGE}>Project page</a>
          <a className="d-quiet" href={REPO}>GitHub</a>
        </div>
      </header>

      <details className="d-menu" ref={menu}>
        <summary><span>Menu</span><b>{pageLabel(path) ?? 'Qendrim UI'}</b></summary>
        <div className="d-menu-body">
          {prefs}
          <SiteNav path={path} label="Menu" />
        </div>
      </details>

      <div className="d-frame">
        <aside className="d-side"><SiteNav path={path} label="Main" /></aside>
        <main id="main" className="d-main">
          <Suspense fallback={<p className="d-page d-loading">Loading</p>}>
            <Route path={path} />
          </Suspense>
          <div className={`${isWide(path) ? 'd-wide' : 'd-page'} d-tail`}>
            <Pager path={path} />
            <footer className="d-footer">
              <p>Qendrim UI is an independent project by Qendrim Beka, under the MIT license and built on Base UI. It is not affiliated with Vercel, MUI or Motion.</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
