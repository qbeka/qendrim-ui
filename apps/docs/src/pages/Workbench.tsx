import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FixtureBody } from '../harness/body';
import { detect, type Violation } from '../harness/detect';
import { IMPLS } from '../harness/impls';
import { Recorder } from '../harness/recorder';
import type { Requested, Sample } from '../harness/types';
import '../harness/fixture.css';
import { Trajectory } from '../lib/Trajectory';

interface StageHandle {
  toggle(): void;
  grow(): void;
  defer(ms: number): void;
  clear(): void;
}

interface Readout {
  requested: Requested;
  rendered: Requested;
  generation: number;
  height: number;
  focus: string;
}

const Stage = forwardRef<StageHandle, { impl: string; width: number; testId: string }>(function Stage({ impl, width, testId }, ref) {
  const entry = IMPLS[impl] ?? (IMPLS['surface'] as NonNullable<(typeof IMPLS)[string]>);
  const Component = entry.component;
  const [open, setOpenState] = useState(false);
  const [details, setDetails] = useState(false);
  const [value, setValue] = useState('Harbor rebuild');
  const [readout, setReadout] = useState<Readout>({ requested: 'closed', rendered: 'closed', generation: 0, height: 0, focus: 'outside' });
  const [points, setPoints] = useState<number[]>([]);
  const [focusLog, setFocusLog] = useState<string[]>([]);
  const [found, setFound] = useState<Violation[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const requested = useRef<Requested>('closed');
  const rendered = useRef<Requested>('closed');
  const generation = useRef(0);
  const deferCloseRef = useRef<((ms: number) => void) | null>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);

  const recorder = useMemo(() => new Recorder({ root: () => rootRef.current, requested: () => requested.current, rendered: () => rendered.current }), []);

  useEffect(() => {
    let lastFocus = '';
    recorder.onSample = (sample: Sample) => {
      setReadout((r) => (r.height === sample.height && r.focus === sample.focus && r.requested === sample.requested && r.rendered === sample.rendered && r.generation === generation.current ? r : { requested: sample.requested, rendered: sample.rendered, generation: generation.current, height: sample.height, focus: sample.focus }));
      setPoints((p) => (p.at(-1) === sample.height ? p : [...p.slice(-299), sample.height]));
      if (sample.focus !== lastFocus) {
        lastFocus = sample.focus;
        setFocusLog((log) => [`${(sample.t / 1000).toFixed(2)} s: ${sample.focus}`, ...log].slice(0, 6));
      }
    };
    recorder.start();
    const timer = setInterval(() => setFound(detect(recorder.trace())), 400);
    return () => {
      recorder.stop();
      clearInterval(timer);
    };
  }, [recorder]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (window.event) {
        requested.current = next ? 'open' : 'closed';
        generation.current += 1;
        recorder.mark('request', requested.current);
      } else {
        recorder.mark('late-commit');
      }
      openRef.current = next;
      setOpenState(next);
    },
    [recorder],
  );

  const onRendered = useCallback((state: Requested) => {
    rendered.current = state;
  }, []);

  useImperativeHandle(ref, () => ({
    toggle: () => setOpen(!openRef.current),
    grow: () => {
      recorder.mark('grow');
      setDetails((d) => !d);
    },
    defer: (ms) => {
      requested.current = 'closed';
      deferCloseRef.current?.(ms);
    },
    clear: () => {
      recorder.reset();
      setPoints([]);
      setFocusLog([]);
      setFound([]);
    },
  }), [recorder, setOpen]);

  return (
    <section className="w-stage" data-testid={testId} style={{ '--stage-width': `${width}px` } as React.CSSProperties}>
      <h2>{entry.label}</h2>
      <p className="w-tag" data-broken={entry.group === 'broken' || undefined}>{entry.group === 'broken' ? 'Test fixture. It is broken on purpose. Do not copy it.' : entry.group === 'library' ? 'This library.' : 'Baseline. A fair, ordinary implementation.'}</p>
      <div ref={rootRef} className="w-frame">
        <Component open={open} setOpen={setOpen} onRendered={onRendered} onTrace={() => undefined} deferCloseRef={deferCloseRef} fallbackFocusRef={fallbackFocusRef} body={<FixtureBody value={value} onValue={setValue} details={details} error={false} onDetails={() => setDetails((d) => !d)} />} />
      </div>
      <dl className="w-readout">
        <div><dt>Requested</dt><dd data-testid={`${testId}-requested`}>{readout.requested}</dd></div>
        <div><dt>Rendered</dt><dd data-testid={`${testId}-rendered`}>{readout.rendered}</dd></div>
        <div><dt>Generation</dt><dd>{readout.generation}</dd></div>
        <div><dt>Height</dt><dd>{readout.height.toFixed(1)} px</dd></div>
      </dl>
      <figure className="w-chart"><Trajectory points={points} width={420} height={72} /><figcaption>Height over time</figcaption></figure>
      <div className="w-log">
        <h3>Focus log</h3>
        <ol>{focusLog.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ol>
      </div>
      <div className="w-log" data-testid={`${testId}-violations`}>
        <h3>Detected</h3>
        {found.length === 0 ? <p>No violations so far.</p> : <ul>{found.slice(0, 4).map((v) => <li key={`${v.kind}-${v.at}`}>{v.kind}: {v.detail}</li>)}</ul>}
      </div>
    </section>
  );
});

export function Workbench() {
  const [right, setRight] = useState('motion-height');
  const [showBroken, setShowBroken] = useState(false);
  const [slow, setSlow] = useState(1);
  const [width, setWidth] = useState(420);
  const [delay, setDelay] = useState(900);
  const a = useRef<StageHandle>(null);
  const b = useRef<StageHandle>(null);

  const both = (action: (s: StageHandle) => void) => {
    if (a.current) action(a.current);
    if (b.current) action(b.current);
  };

  const options = Object.entries(IMPLS).filter(([key, entry]) => key !== 'surface' && (entry.group === 'baseline' || showBroken));

  return (
    <div className="d-wide" style={{ '--q-surface-response': 320 * slow } as React.CSSProperties}>
      <h1>Workbench</h1>
      <p className="d-lede">Both sides get the same requests at the same moment. The detectors on this page are the ones the browser tests use. Baselines use their own timing, so the slow-down control only changes this library.</p>

      <div className="w-controls" role="group" aria-label="Workbench controls">
        <button type="button" className="q-button" data-variant="primary" data-testid="w-toggle" onClick={() => both((s) => s.toggle())}>Reverse now</button>
        <button type="button" className="q-button" data-testid="w-grow" onClick={() => both((s) => s.grow())}>Grow content</button>
        <button type="button" className="q-button" data-testid="w-defer" onClick={() => both((s) => s.defer(delay))}>Close after a delay</button>
        <button type="button" className="q-button" onClick={() => both((s) => s.clear())}>Clear</button>
        <label>Delay<select value={delay} onChange={(e) => setDelay(Number(e.target.value))}><option value={400}>400 ms</option><option value={900}>900 ms</option><option value={2000}>2 s</option></select></label>
        <label>Speed<select value={slow} onChange={(e) => setSlow(Number(e.target.value))}><option value={1}>Normal</option><option value={3}>Slower</option><option value={8}>Slowest</option></select></label>
        <label>Stage width<input type="range" min={280} max={560} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
        <label>Compare with<select data-testid="w-right" value={right} onChange={(e) => setRight(e.target.value)}>{options.map(([key, entry]) => <option key={key} value={key}>{entry.label}</option>)}</select></label>
        <label className="ex-check"><input type="checkbox" data-testid="w-broken" checked={showBroken} onChange={(e) => { setShowBroken(e.target.checked); if (!e.target.checked && IMPLS[right]?.group === 'broken') setRight('motion-height'); }} /> Show broken test fixtures</label>
      </div>

      <div className="w-grid">
        <Stage ref={a} impl="surface" width={width} testId="w-a" />
        <Stage key={right} ref={b} impl={right} width={width} testId="w-b" />
      </div>
    </div>
  );
}
