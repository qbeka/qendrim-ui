import { useEffect, useState } from 'react';
import { COMPONENTS, type ComponentDoc } from '../docs/components';
import { GUIDES } from '../docs/guides';
import { PREVIEWS } from '../docs/previews';
import { Gallery, Specimen, hasSpecimen } from '../gallery/Gallery';
import { Code } from '../lib/Copy';
import { LiveExample } from '../lib/LiveExample';
import { Link } from '../lib/router';

interface Section {
  id: string;
  text: string;
}

/**
 * The sections of the page, read from its headings. They are buttons and not links, because
 * the docs can be built with routes in the hash, and an anchor there would replace the route.
 */
function OnThisPage({ page }: { page: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  useEffect(() => {
    const headings = [...document.querySelectorAll<HTMLElement>('#main .d-doc-body > h2')];
    setSections(headings.map((heading, index) => {
      heading.id = `section-${index + 1}`;
      heading.tabIndex = -1;
      return { id: heading.id, text: heading.textContent ?? '' };
    }));
  }, [page]);
  if (sections.length < 2) return null;
  const go = (id: string) => {
    const heading = document.getElementById(id);
    if (!heading) return;
    heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };
  return (
    <nav className="d-toc" aria-label="On this page">
      <p>On this page</p>
      <ul>{sections.map((section) => <li key={section.id}><button type="button" onClick={() => go(section.id)}>{section.text}</button></li>)}</ul>
    </nav>
  );
}

export function ComponentIndex() {
  const foundation = COMPONENTS.filter((c) => c.group === 'Foundation');
  return (
    <div className="d-wide">
      <h1>Components</h1>
      <p className="d-lede">Four components are what this library adds, and eight are Base UI primitives with styles. Use the recipe and theme controls above to see all of them change at once.</p>
      <h2>Signature</h2>
      <p>Each one here works, and sits above the code that makes it.</p>
      <Gallery docsLink={(slug, name) => <Link to={`/components/${slug}`}>{name} API and keyboard map</Link>} />
      <h2>Foundation</h2>
      <p>Accessible behavior comes from Base UI, which is the right place for it. These add styles and a shorter API.</p>
      <ul className="d-foundation">
        {foundation.map((doc) => (
          <li key={doc.slug} data-testid={`preview-${doc.slug}`}>
            <div className="d-preview">{PREVIEWS[doc.slug]}</div>
            <div className="d-foundation-text">
              <Link to={`/components/${doc.slug}`}>{doc.name}</Link>
              <p>{doc.summary}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComponentPage({ slug }: { slug: string }) {
  const doc = COMPONENTS.find((c) => c.slug === slug);
  if (!doc) return <NotFound />;
  return (
    <div className="d-doc">
      <div className="d-page d-doc-body">
        <p className="d-crumb"><Link to="/components">Components</Link><span aria-hidden="true">/</span>{doc.group}</p>
        <h1>{doc.name}</h1>
        <p className="d-lede">{doc.summary}</p>
        {hasSpecimen(doc.slug) ? <Specimen key={`specimen-${doc.slug}`} slug={doc.slug} /> : null}
        <h2>Try it</h2>
        <LiveExample key={doc.slug} code={doc.example} />
        <h2>Import</h2>
        <Code>{doc.importLine}</Code>
        <p>Styles are in <code>{doc.css}</code>, or in the combined <code>styles.css</code>.</p>
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
            <tbody>{doc.keyboard.map((row) => <tr key={row.keys}><td className="d-keys">{row.keys}</td><td>{row.action}</td></tr>)}</tbody>
          </table>
        </div>
        {doc.notes ? <><h2>Good to know</h2><ul className="d-notes">{doc.notes.map((n) => <li key={n}>{n}</li>)}</ul></> : null}
        <h2>What comes from upstream</h2>
        <p>{doc.upstream}</p>
      </div>
      <OnThisPage page={doc.slug} />
    </div>
  );
}

export function GuidePage({ slug }: { slug: string }) {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) return <NotFound />;
  return (
    <div className="d-doc">
      <div className="d-page d-prose d-doc-body">
        <p className="d-crumb">Guide</p>
        <h1>{guide.title}</h1>
        {guide.body()}
      </div>
      <OnThisPage page={guide.slug} />
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

export type { ComponentDoc };
