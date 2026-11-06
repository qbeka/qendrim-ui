import { lazy, Suspense, useEffect, useState } from 'react';
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

const NAV = [
  { to: '/examples/projects', label: 'Examples' },
  { to: '/workbench', label: 'Workbench' },
  { to: '/components', label: 'Components' },
  { to: '/guide/install', label: 'Guide' },
  { to: '/evidence', label: 'Evidence' },
];

function Route({ path }: { path: string }) {
  if (path === '/') return <Home />;
  if (path === '/examples/projects') return <div className="d-wide"><Examples current="projects" /><ProjectsApp /></div>;
  if (path === '/examples/receipts') return <div className="d-wide"><Examples current="receipts" /><ReceiptsApp /></div>;
  if (path === '/workbench') return <Workbench />;
  if (path === '/evidence') return <Evidence />;
  if (path === '/components') return <ComponentIndex />;
  const component = path.match(/^\/components\/([a-z]+)$/);
  if (component?.[1]) return <ComponentPage slug={component[1]} />;
  const guide = path.match(/^\/guide\/([a-z-]+)$/);
  if (guide?.[1]) return <GuidePage slug={guide[1]} />;
  return <NotFound />;
}

function Examples({ current }: { current: string }) {
  return (
    <nav className="d-guide-nav" aria-label="Examples">
      <Link to="/examples/projects" aria-current={current === 'projects' ? 'page' : undefined}>Project inspector</Link>
      <Link to="/examples/receipts" aria-current={current === 'receipts' ? 'page' : undefined}>Receipt review</Link>
    </nav>
  );
}

export function App() {
  const path = usePath();
  const [theme, setTheme] = usePreference<Theme>('q-docs-theme', 'system');
  const [recipe, setRecipe] = usePreference<Recipe>('q-docs-recipe', 'studio');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['qRecipe'] = recipe;
    if (theme === 'system') delete root.dataset['qTheme'];
    else root.dataset['qTheme'] = theme;
  }, [theme, recipe]);

  useEffect(() => {
    document.title = path === '/' ? 'Qendrim UI' : `${path.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ')} · Qendrim UI`;
  }, [path]);

  if (path === '/fixture') return <Suspense fallback={null}><Fixture /></Suspense>;
  if (path === '/fixture/foundation') return <Suspense fallback={null}><FoundationCompare /></Suspense>;
  if (path === '/fixture/special') return <Suspense fallback={null}><SpecialFixtures /></Suspense>;

  return (
    <div className="d-site">
      <a className="d-skip" href="#main">Skip to content</a>
      <header className="d-header">
        <Link to="/" className="d-mark">Qendrim UI</Link>
        <nav aria-label="Main">
          {NAV.map((item) => <Link key={item.to} to={item.to} aria-current={path.startsWith(item.to.split('/').slice(0, 2).join('/')) ? 'page' : undefined}>{item.label}</Link>)}
        </nav>
        <div className="d-prefs">
          <label>Recipe<select value={recipe} onChange={(e) => setRecipe(e.target.value as Recipe)}><option value="studio">Studio</option><option value="editorial">Editorial</option></select></label>
          <label>Theme<select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<p className="d-page">Loading…</p>}>
          <Route path={path} />
        </Suspense>
      </main>
      <footer className="d-footer">
        <p>Qendrim UI is an independent project by Qendrim Beka. MIT license. Built on Base UI. It is not affiliated with Vercel, MUI or Motion.</p>
      </footer>
    </div>
  );
}
