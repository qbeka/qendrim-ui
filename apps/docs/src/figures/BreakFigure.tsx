import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { detect, type Violation } from '../harness/detect';
import { BrokenDuplicate, BrokenStretch } from '../harness/impls/broken';
import { SurfaceImpl } from '../harness/impls/surface';
import { Recorder } from '../harness/recorder';
import type { ImplProps, Requested, Sample } from '../harness/types';
import '../harness/fixture.css';
import './break.css';

/**
 * Two of the suite's own fixtures beside the library, under the suite's own recorder and
 * detector. The fixtures are the seeded failures that prove the detector can see a fault:
 * one animates its content with a scale, the other shows a second live copy during the move.
 */
const FIXTURES = {
  scale: { label: 'Scaled', name: 'A panel that scales its content', component: BrokenStretch, metric: 'Height the field is drawn at, against its real height' },
  copy: { label: 'Copied', name: 'A panel that shows a copy while it moves', component: BrokenDuplicate, metric: 'Live copies of the field on the page' },
} as const;
type FixtureId = keyof typeof FIXTURES;

const WINDOW_MS = 4200;
const AWAKE_MS = 2600;
const CHART = { width: 320, height: 64 };

const SAID: Record<Violation['kind'], (detail: string) => string> = {
  'text-stretch': (detail) => {
    const drawn = Number(detail.match(/by ([\d.]+)/)?.[1] ?? 1);
    return `It drew the field at ${Math.round(drawn * 100)} percent of its height`;
  },
  'duplicate-interactive': () => 'It put two live copies of the field on the page',
  'geometry-jump': (detail) => `Its box jumped ${Math.round(Number(detail.match(/moved ([\d.]+)/)?.[1] ?? 0))} px in one frame`,
  'focus-lost': () => 'It dropped focus to the page',
  'stale-final-state': () => 'It ended in a state that was not the last one asked for',
  'value-lost': () => 'It lost the text',
};

interface LaneHandle {
  reverse(): void;
}

interface LaneProps {
  component: React.ComponentType<ImplProps>;
  name: string;
  tag: string;
  metric: FixtureId;
  own?: boolean;
  testId: string;
}

const Lane = forwardRef<LaneHandle, LaneProps>(function Lane({ component: Component, name, tag, metric, own = false, testId }, ref) {
  const [open, setOpenState] = useState(true);
  const [value, setValue] = useState('Harbor rebuild');
  const [found, setFound] = useState<Violation[]>([]);
  const [frames, setFrames] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const boxLine = useRef<SVGPolylineElement>(null);
  const metricLine = useRef<SVGPolylineElement>(null);
  const marks = useRef<SVGGElement>(null);
  const openRef = useRef(true);
  const requested = useRef<Requested>('open');
  const rendered = useRef<Requested>('open');
  const deferCloseRef = useRef<((ms: number) => void) | null>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const sleep = useRef(0);
  const tallest = useRef(1);

  const recorder = useMemo(() => new Recorder({ root: () => root.current, requested: () => requested.current, rendered: () => rendered.current }), []);

  const draw = useCallback(() => {
    const { samples, events } = recorder.trace();
    const now = samples.at(-1)?.t ?? 0;
    const from = now - WINDOW_MS;
    const x = (t: number) => ((t - from) / WINDOW_MS) * CHART.width;
    let box = '';
    let line = '';
    for (const sample of samples) {
      if (sample.t < from) continue;
      tallest.current = Math.max(tallest.current, sample.height);
      const share = metric === 'scale' ? (sample.inputVisible ? sample.inputScaleY : 1) / 1.25 : sample.interactive / 2.5;
      box += `${x(sample.t).toFixed(1)},${(CHART.height - (sample.height / tallest.current) * (CHART.height - 6) - 1).toFixed(1)} `;
      line += `${x(sample.t).toFixed(1)},${(CHART.height - Math.min(share, 1) * (CHART.height - 6) - 1).toFixed(1)} `;
    }
    boxLine.current?.setAttribute('points', box);
    metricLine.current?.setAttribute('points', line);
    if (marks.current) {
      marks.current.replaceChildren(...events.filter((event) => event.type === 'request' && event.t >= from).map((event) => {
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', x(event.t).toFixed(1));
        tick.setAttribute('x2', x(event.t).toFixed(1));
        tick.setAttribute('y1', '0');
        tick.setAttribute('y2', String(CHART.height));
        return tick;
      }));
    }
  }, [metric, recorder]);

  /** The recorder reads the page every frame, so it runs only for a while after something happens. */
  const wake = useCallback(() => {
    recorder.start();
    clearTimeout(sleep.current);
    sleep.current = window.setTimeout(() => {
      recorder.stop();
      setFound(detect(recorder.trace()));
      setFrames(recorder.samples.length);
    }, AWAKE_MS);
  }, [recorder]);

  useEffect(() => {
    recorder.onSample = (_sample: Sample) => {
      draw();
      if (recorder.samples.length % 12 === 0) {
        setFound(detect(recorder.trace()));
        setFrames(recorder.samples.length);
      }
    };
    return () => {
      recorder.stop();
      clearTimeout(sleep.current);
    };
  }, [draw, recorder]);

  const setOpen = useCallback((next: boolean) => {
    // A call made inside an event is a request. One made later, from a timer, is a late commit.
    if (window.event) {
      requested.current = next ? 'open' : 'closed';
      wake();
      recorder.mark('request', requested.current);
    } else {
      recorder.mark('late-commit');
    }
    openRef.current = next;
    setOpenState(next);
  }, [recorder, wake]);

  const onRendered = useCallback((state: Requested) => {
    rendered.current = state;
  }, []);

  useImperativeHandle(ref, () => ({ reverse: () => setOpen(!openRef.current) }), [setOpen]);

  const kinds = [...new Map(found.map((violation) => [violation.kind, violation])).values()];
  const base = metric === 'scale' ? CHART.height - (1 / 1.25) * (CHART.height - 6) - 1 : CHART.height - (1 / 2.5) * (CHART.height - 6) - 1;

  return (
    <section className="brk-lane" data-own={own || undefined} data-testid={testId} aria-label={name}>
      <header>
        <h4>{name}</h4>
        <p>{tag}</p>
      </header>
      <div className="brk-stand" ref={root} onInput={wake}>
        <Component open={open} setOpen={setOpen} onRendered={onRendered} onTrace={() => undefined} deferCloseRef={deferCloseRef} fallbackFocusRef={fallbackFocusRef}
          body={(
            <div className="fx-body">
              <label>Project name<input data-probe="input" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" spellCheck={false} /></label>
              <p className="brk-line">The pier survey comes first, and dredging waits for the tide tables</p>
            </div>
          )} />
      </div>
      <figure className="brk-chart">
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
          <line className="brk-base" x1="0" x2={CHART.width} y1={base} y2={base} />
          <g className="brk-marks" ref={marks} />
          <polyline className="brk-box" ref={boxLine} />
          <polyline className="brk-metric" ref={metricLine} />
        </svg>
        <figcaption>{FIXTURES[metric].metric}</figcaption>
      </figure>
      <p className="brk-verdict" data-bad={kinds.length > 0 || undefined} data-testid={`${testId}-verdict`} role="status">
        {frames === 0 ? 'The detector has read nothing yet' : kinds.length === 0 ? `The detector found nothing in ${frames.toLocaleString('en-US')} frames` : kinds.map((violation, index) => { const said = SAID[violation.kind](violation.detail); return index === 0 ? said : said.charAt(0).toLowerCase() + said.slice(1); }).join(', and ')}
      </p>
    </section>
  );
});

export function BreakFigure() {
  const [fixture, setFixture] = useState<FixtureId>('scale');
  const left = useRef<LaneHandle>(null);
  const right = useRef<LaneHandle>(null);
  const entry = FIXTURES[fixture];

  const reverse = () => {
    left.current?.reverse();
    right.current?.reverse();
  };

  return (
    <div className="brk" data-testid="break">
      <div className="brk-bar">
        <button type="button" className="brk-btn brk-primary" onClick={reverse} data-testid="break-reverse">Reverse both</button>
        <div className="brk-seg" role="group" aria-label="The broken panel">
          {(Object.keys(FIXTURES) as FixtureId[]).map((id) => (
            <button key={id} type="button" className="brk-btn" aria-pressed={fixture === id} onClick={() => setFixture(id)} data-testid={`break-${id}`}>{FIXTURES[id].label}</button>
          ))}
        </div>
        <p>Press it again before the panels land, or type in a field while it moves</p>
      </div>
      <div className="brk-lanes">
        <Lane key={fixture} ref={left} component={entry.component} name={entry.name} tag="A fixture from the test suite, broken on purpose" metric={fixture} testId="break-left" />
        <Lane key={`own-${fixture}`} ref={right} component={SurfaceImpl} name="One live element" tag="Surface, through Inspector" metric={fixture} own testId="break-right" />
      </div>
    </div>
  );
}
