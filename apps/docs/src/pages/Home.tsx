import type { InspectorTrace } from '@qbeka/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProjectRow } from '../examples/ProjectRow';
import { PROJECTS } from '../examples/projects-data';
import { Code } from '../lib/Copy';
import { Link } from '../lib/router';
import { Trajectory } from '../lib/Trajectory';

const INSTALL = 'npm install @qbeka/react';

const USAGE = `import { Inspector } from '@qbeka/react/inspector';
import '@qbeka/react/styles.css';

<Inspector.Root>
  <Inspector.Trigger>Harbor rebuild</Inspector.Trigger>
  <Inspector.Panel label="Edit Harbor rebuild">
    <input aria-label="Name" defaultValue="Harbor rebuild" />
  </Inspector.Panel>
</Inspector.Root>`;

interface Steps {
  opened: boolean;
  reversed: number;
  grew: boolean;
  resized: boolean;
  typed: boolean;
}

export function Home() {
  const [project, setProject] = useState(PROJECTS[0] as (typeof PROJECTS)[number]);
  const [steps, setSteps] = useState<Steps>({ opened: false, reversed: 0, grew: false, resized: false, typed: false });
  const [points, setPoints] = useState<number[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const moving = useRef(false);

  const onTrace = useCallback((event: InspectorTrace) => {
    if (event.type === 'request') {
      setSteps((s) => ({ ...s, opened: s.opened || event.shape === 'open', reversed: moving.current ? s.reversed + 1 : s.reversed }));
      moving.current = true;
    }
    if (event.type === 'retarget' && event.reason === 'content') setSteps((s) => ({ ...s, grew: true }));
    if (event.type === 'settle') moving.current = false;
  }, []);

  useEffect(() => {
    const onResize = () => setSteps((s) => (s.opened ? { ...s, resized: true } : s));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // Draws the real height of the demo. The line stays still when the page is at rest.
    let frame = 0;
    let last = -1;
    const tick = () => {
      const box = stage.current?.querySelector<HTMLElement>('[data-q-surface]');
      const height = box?.getBoundingClientRect().height ?? 0;
      // Only a real move adds to the line. Fonts settling on load are not a move.
      if (height !== last && moving.current) setPoints((p) => [...p.slice(-239), height]);
      last = height;
      frame = requestAnimationFrame(tick);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const list = useMemo(
    () => [
      { label: 'Open the row', done: steps.opened },
      { label: 'Reverse it twice while it moves', done: steps.reversed >= 2 },
      { label: 'Show details, so the target grows', done: steps.grew },
      { label: 'Resize the window', done: steps.resized },
      { label: 'Keep typing', done: steps.typed },
    ],
    [steps],
  );

  return (
    <div className="d-page d-home">
      <h1>Panels that keep working when you change your mind.</h1>
      <p className="d-lede">Qendrim UI is a React component library. Its panels can be reversed, resized and refilled mid-move, and they keep your text, your focus and your place.</p>

      <div className="d-demo" ref={stage} onInput={() => setSteps((s) => (s.opened ? { ...s, typed: true } : s))}>
        <ProjectRow project={project} onChange={setProject} saveOptions={{ delay: 700, fail: false }} onTrace={onTrace} />
        <div className="d-demo-after" aria-hidden>Field survey<span>Paused</span></div>
      </div>

      <div className="d-interrupt">
        <div>
          <h2>Interrupt it</h2>
          <ol className="d-steps">
            {list.map((step) => (
              <li key={step.label} data-done={step.done || undefined}>
                <span aria-hidden>{step.done ? '✓' : ''}</span>
                {step.label}
                <span className="d-visually-hidden">{step.done ? ' (done)' : ''}</span>
              </li>
            ))}
          </ol>
        </div>
        <figure className="d-trajectory">
          <Trajectory points={points} />
          <figcaption>Measured height of the row above, frame by frame.</figcaption>
        </figure>
      </div>

      <h2>Install</h2>
      <Code>{INSTALL}</Code>
      <Code>{USAGE}</Code>
      <p className="d-note">The package is not on npm yet. The <Link to="/guide/install">install guide</Link> shows how to use the tarball.</p>

      <h2>What is here</h2>
      <ul className="d-links">
        <li><Link to="/examples/projects">Project inspector</Link>: a working editor with save, failure, undo and diagnostics.</li>
        <li><Link to="/examples/receipts">Receipt review</Link>: a modal review, a timeline and contextual actions.</li>
        <li><Link to="/workbench">Workbench</Link>: this library next to Motion, CSS and broken fixtures, under the same test.</li>
        <li><Link to="/components">Components</Link>: eight foundation components on Base UI, and four signature ones.</li>
        <li><Link to="/guide/contract">The contract</Link>: what is promised, and what is not.</li>
        <li><Link to="/evidence">Evidence</Link>: measurements with their method and limits.</li>
      </ul>
    </div>
  );
}
