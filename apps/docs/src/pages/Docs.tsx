import { COMPONENTS, type ComponentDoc } from '../docs/components';
import { Gallery } from '../gallery/Gallery';
import { GUIDES } from '../docs/guides';
import { Code } from '../lib/Copy';
import { LiveExample } from '../lib/LiveExample';
import { Link } from '../lib/router';

export function ComponentIndex() {
  const group = (name: ComponentDoc['group']) => COMPONENTS.filter((c) => c.group === name);
  return (
    <div className="d-page">
      <h1>Components</h1>
      <h2>Signature</h2>
      <p>These four are what this library adds. Each one here works, and sits next to the code that makes it.</p>
      <Gallery docsLink={(slug, name) => <Link to={`/components/${slug}`}>{name} API and keyboard map</Link>} />
      <h2>Foundation</h2>
      <p>These eight are Base UI primitives with styles. Accessible behavior comes from Base UI, which is the right place for it.</p>
      <ul className="d-links">{group('Foundation').map((c) => <li key={c.slug}><Link to={`/components/${c.slug}`}>{c.name}</Link>: {c.summary}</li>)}</ul>
    </div>
  );
}

export function ComponentPage({ slug }: { slug: string }) {
  const doc = COMPONENTS.find((c) => c.slug === slug);
  if (!doc) return <NotFound />;
  const index = COMPONENTS.indexOf(doc);
  const next = COMPONENTS[(index + 1) % COMPONENTS.length] as ComponentDoc;
  return (
    <div className="d-page">
      <p className="d-crumb"><Link to="/components">Components</Link></p>
      <h1>{doc.name}</h1>
      <p className="d-lede">{doc.summary}</p>
      <LiveExample key={doc.slug} code={doc.example} />
      <h2>Import</h2>
      <Code>{doc.importLine}</Code>
      <p>Styles: <code>{doc.css}</code>, or the combined <code>styles.css</code>.</p>
      <h2>What comes from upstream</h2>
      <p>{doc.upstream}</p>
      {doc.notes ? <><h2>Good to know</h2><ul>{doc.notes.map((n) => <li key={n}>{n}</li>)}</ul></> : null}
      <h2>API</h2>
      <div className="d-table">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>What it does</th></tr></thead>
          <tbody>{doc.api.map((row) => <tr key={row.name}><td><code>{row.name}</code></td><td><code>{row.type}</code></td><td>{row.note}</td></tr>)}</tbody>
        </table>
      </div>
      <h2>Keyboard</h2>
      <div className="d-table">
        <table>
          <thead><tr><th>Keys</th><th>Action</th></tr></thead>
          <tbody>{doc.keyboard.map((row) => <tr key={row.keys}><td>{row.keys}</td><td>{row.action}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="d-next">Next: <Link to={`/components/${next.slug}`}>{next.name}</Link></p>
    </div>
  );
}

export function GuidePage({ slug }: { slug: string }) {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) return <NotFound />;
  return (
    <div className="d-page d-prose">
      <nav className="d-guide-nav" aria-label="Guides">{GUIDES.map((g) => <Link key={g.slug} to={`/guide/${g.slug}`} aria-current={g.slug === slug ? 'page' : undefined}>{g.title}</Link>)}</nav>
      <h1>{guide.title}</h1>
      {guide.body()}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="d-page">
      <h1>That page is not here</h1>
      <p><Link to="/">Go to the start</Link>.</p>
    </div>
  );
}
