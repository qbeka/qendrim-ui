import { FIRST_EXAMPLE, INSTALL } from '../gallery/usage';
import { Code } from '../lib/Copy';
import { Link } from '../lib/router';
import { Showpiece } from '../showpiece/Showpiece';

const PLACES = [
  { to: '/components', title: 'Components', text: 'Four signature components with working specimens, and eight Base UI primitives with styles' },
  { to: '/guide/contract', title: 'The contract', text: 'What stays true when a panel is interrupted, and what is not promised' },
  { to: '/examples/projects', title: 'Project inspector', text: 'A working editor with save, failure, undo and diagnostics' },
  { to: '/examples/receipts', title: 'Receipt review', text: 'A modal review, a timeline and contextual actions' },
  { to: '/workbench', title: 'Workbench', text: 'This library next to Motion, CSS and broken fixtures, under the same test' },
  { to: '/evidence', title: 'Evidence', text: 'Measurements with their method, their baselines and their limits' },
];

export function Home() {
  return (
    <div className="d-wide d-home">
      <h1>Panels that keep working when you change your mind</h1>
      <p className="d-lede">Qendrim UI is a React component library. Its panels can be reversed, resized and refilled mid-move, and they keep your text, your focus and your place.</p>

      <Showpiece />

      <h2>Start</h2>
      <p>The package is not on npm, so this installs the 0.1.0 release file from GitHub. It needs React 18.3 or 19.</p>
      <div className="d-start">
        <Code label="Install it">{INSTALL}</Code>
        <Code label="Paste a first panel">{FIRST_EXAMPLE}</Code>
      </div>
      <p className="d-note">The <Link to="/guide/install">install guide</Link> covers styles, cascade layers, recipes and themes.</p>

      <h2>What is here</h2>
      <ul className="d-places">
        {PLACES.map((place) => (
          <li key={place.to}><Link to={place.to}><b>{place.title}</b><span>{place.text}</span></Link></li>
        ))}
      </ul>
    </div>
  );
}
