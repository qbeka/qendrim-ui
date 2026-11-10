import { Surface, type TraceEvent } from '@qbeka/react/surface';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useCopy } from '../lib/useCopy';
import { createCaretReader } from './caret';
import { EXPOSURE } from './exposure';
import { CURVE, DAMPING, HOLD_SPRING, LAYOUTS, PRESETS, RATE, RESPONSE, aimLayout, curvePath, holdOrigin, nextLayout, otherLayout, overshoot, parseState, serializeState, springCss, stepLayout, travelSpeed, type Layout, type PlanBox, type ShowState, type SpringSetting } from './model';
import { createTrace } from './trace';
import './showpiece.css';

type Mode = 'idle' | 'yours';

const IDLE_FIRST_MS = 1500;
const IDLE_EVERY_MS = 3100;
const REDUCED_RATE = 2;
/** A press becomes a hold once the pointer has gone this far. */
const HOLD_SLOP_PX = 4;
const NOT_INPUT_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta']);
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const CHECKS = ['Isolate the old sensor', 'Fit the new float', 'Check it against the pier mark'];
const LAYOUT_NOUN: Record<Layout, string> = { row: 'a row', card: 'a card', editor: 'an editor', sheet: 'a sheet' };

/** Keeps focus where it is when a control is pressed, so a person can keep typing. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

const isTextField = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text');

const count = (value: number) => value.toLocaleString('en-US');

interface BenchProps {
  spring: SpringSetting;
  rate: number;
  reduced: boolean;
  onSpring: (spring: SpringSetting, settled: boolean) => void;
  onRate: (rate: number) => void;
  link: (() => string) | null;
}

/** The spring, drawn from the library's own equation, with the CSS that sets it. */
const Bench = memo(function Bench({ spring, rate, reduced, onSpring, onRate, link }: BenchProps) {
  const css = springCss(spring);
  const code = useCopy(css);
  const [linkState, setLinkState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const linkTimer = useRef(0);
  useEffect(() => () => clearTimeout(linkTimer.current), []);

  const copyLink = async () => {
    if (!link) return;
    clearTimeout(linkTimer.current);
    try {
      await navigator.clipboard.writeText(link());
      setLinkState('copied');
    } catch {
      setLinkState('failed');
    }
    linkTimer.current = window.setTimeout(() => setLinkState('idle'), 1600);
  };

  const over = overshoot(spring.damping);
  const preset = PRESETS.find((item) => item.spring.response === spring.response && item.spring.damping === spring.damping)?.id;
  const targetY = CURVE.height - CURVE.height / CURVE.top;
  const fill = (value: number, range: { min: number; max: number }) => ({ '--fill': `${((value - range.min) / (range.max - range.min)) * 100}%` }) as CSSProperties;

  return (
    <aside className="show-bench" aria-label="Spring settings">
      <div className="show-cell show-cell-spring">
        <div className="show-cell-head">
          <h2>Spring</h2>
          <div className="show-presets" role="group" aria-label="Spring presets">
            {PRESETS.map((item) => (
              <button key={item.id} type="button" className="show-btn show-small" aria-pressed={preset === item.id} onClick={() => onSpring(item.spring, true)} data-testid={`preset-${item.id}`}>{item.label}</button>
            ))}
          </div>
        </div>
        <figure className="show-curve">
          <svg viewBox={`0 -6 ${CURVE.width} ${CURVE.height + 12}`} preserveAspectRatio="none" role="img" aria-label={over > 0.005 ? `The spring passes its target by ${Math.round(over * 100)} percent, then settles` : 'The spring reaches its target with no overshoot'}>
            <line className="show-curve-target" x1="0" x2={CURVE.width} y1={targetY} y2={targetY} />
            <line className="show-curve-base" x1="0" x2={CURVE.width} y1={CURVE.height} y2={CURVE.height} />
            <path className="show-curve-line" d={curvePath(spring)} data-testid="curve" />
          </svg>
          <figcaption><span>0 s</span><span>Step response</span><span>{CURVE.seconds} s</span></figcaption>
        </figure>
      </div>

      <label className="show-cell show-slider">
        <span>Response</span>
        <output data-testid="response-out">{spring.response} ms</output>
        <input type="range" min={RESPONSE.min} max={RESPONSE.max} step={RESPONSE.step} value={spring.response} style={fill(spring.response, RESPONSE)} data-testid="response"
          onChange={(event) => onSpring({ ...spring, response: Number(event.target.value) }, false)}
          onPointerUp={() => onSpring(spring, true)} onKeyUp={(event) => { if (SLIDER_KEYS.has(event.key)) onSpring(spring, true); }} />
        <small>Undamped period</small>
      </label>
      <label className="show-cell show-slider">
        <span>Damping</span>
        <output data-testid="damping-out">{spring.damping.toFixed(2)}</output>
        <input type="range" min={DAMPING.min} max={DAMPING.max} step={DAMPING.step} value={spring.damping} style={fill(spring.damping, DAMPING)} data-testid="damping"
          onChange={(event) => onSpring({ ...spring, damping: Number(event.target.value) }, false)}
          onPointerUp={() => onSpring(spring, true)} onKeyUp={(event) => { if (SLIDER_KEYS.has(event.key)) onSpring(spring, true); }} />
        <small>{over > 0.005 ? `Overshoots by ${Math.round(over * 100)} percent` : 'No overshoot'}</small>
      </label>
      <label className="show-cell show-slider show-rate">
        <span>Rate</span>
        <output data-testid="rate-out">{reduced ? `${REDUCED_RATE} a second, reduced motion` : `${rate} a second`}</output>
        <input type="range" min={RATE.min} max={RATE.max} step={RATE.step} value={rate} style={fill(rate, RATE)} aria-disabled={reduced || undefined} data-testid="rate"
          onChange={(event) => { if (!reduced) onRate(Number(event.target.value)); }} />
        <small>Sent by Interrupt</small>
      </label>

      <div className="show-cell show-code">
        <pre tabIndex={0} aria-label="CSS for this spring" data-testid="spring-css"><code>{css}</code></pre>
        <div className="show-code-end">
          <button type="button" className="show-btn show-small show-outline" onClick={code.copy} data-testid="copy-css">
            <span className="show-swap">
              <span data-on={code.state === 'idle' || undefined}>Copy CSS</span>
              <span data-on={code.state === 'copied' || undefined}>Copied</span>
              <span data-on={code.state === 'failed' || undefined}>Copy failed</span>
            </span>
          </button>
          {link ? (
            <button type="button" className="show-btn show-small" onClick={copyLink} data-testid="copy-link">
              <span className="show-swap">
                <span data-on={linkState === 'idle' || undefined}>Copy link</span>
                <span data-on={linkState === 'copied' || undefined}>Copied</span>
                <span data-on={linkState === 'failed' || undefined}>Copy failed</span>
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
});

interface MarksProps {
  shown: Layout | null;
  aim: Layout | null;
  onChoose: (layout: Layout) => void;
}

/** The plan: the four places, each with its measured width and height on dimension lines. */
const Marks = memo(function Marks({ shown, aim, onChoose }: MarksProps) {
  return (
    <>
      {LAYOUTS.map((item) => (
        <button key={item.id} type="button" tabIndex={-1} aria-hidden="true" className="show-slot" data-slot={item.id} data-here={shown === item.id || undefined} data-aim={aim === item.id || undefined} onMouseDown={keepFocus} onClick={() => onChoose(item.id)}>
          <span className="show-dim show-dim-w"><span className="show-dim-text"><b>{item.label}</b><i data-measure="width" /></span></span>
          <span className="show-dim show-dim-h"><span className="show-dim-text"><i data-measure="height" /></span></span>
        </button>
      ))}
      <p className="show-legend" aria-hidden="true">
        <span><i className="show-key show-key-box" />Its measured box, {EXPOSURE.stampEveryMs} ms apart</span>
        <span><i className="show-key show-key-corner" />Its corners, every frame</span>
        <span><i className="show-key show-key-caret" />The caret, or the end of the title</span>
      </p>
    </>
  );
});

interface BodyProps {
  layout: Layout;
  mac: boolean;
  titleRef: RefObject<HTMLInputElement | null>;
}

const Check = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/**
 * The work order. Its fields are the same elements in every layout, and they hold their
 * own text, so neither typing nor a move of the panel renders the other.
 */
const Body = memo(function Body({ layout, mac, titleRef }: BodyProps) {
  const [title, setTitle] = useState('Replace the north tide gauge');
  const [notes, setNotes] = useState('It has read 4 cm high since the storm. Swap the float, then check it against the pier mark at slack water.');
  const [checks, setChecks] = useState([true, false, false]);
  const done = checks.filter(Boolean).length;

  return (
    <div className="show-note-body" data-layout={layout}>
      <span className="wo-ring" aria-hidden="true" />
      <p className="show-part wo-state" data-in="card editor sheet">In progress</p>
      <p className="show-part wo-id" data-in="card editor sheet"><span>WO-118</span><span className="wo-site">North pier</span></p>

      <input ref={titleRef} className="show-title" type="text" aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} data-field="Title" data-testid="title" autoComplete="off" spellCheck={false} enterKeyHint="done" />
      <textarea className="show-part show-text" data-in="card editor sheet" aria-label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} data-field="Notes" data-testid="notes" spellCheck={false} rows={1} />

      <div className="show-part wo-meta" data-in="row">
        <span className="wo-pips" role="img" aria-label={`${done} of ${CHECKS.length} checks done`}>{checks.map((on, index) => <i key={index} data-on={on || undefined} />)}</span>
        <span className="wo-due">Fri 14 Nov</span>
        <span className="wo-avatar" aria-label="Mira Okafor" role="img">MO</span>
      </div>

      <div className="show-part wo-foot" data-in="card">
        <span className="wo-avatar" aria-hidden="true">MO</span>
        <span className="wo-name">Mira Okafor</span>
        <span className="wo-pips" role="img" aria-label={`${done} of ${CHECKS.length} checks done`}>{checks.map((on, index) => <i key={index} data-on={on || undefined} />)}</span>
        <span className="wo-due">Fri 14 Nov</span>
      </div>

      <div className="show-part wo-tools" data-in="editor">
        <span className="wo-chip"><span className="wo-avatar wo-avatar-small" aria-hidden="true">MO</span>Mira Okafor</span>
        <span className="wo-chip">Fri 14 Nov</span>
        <span className="wo-keys"><kbd title="Escape makes it smaller">Esc</kbd><span className="show-sr"> makes it smaller and </span><kbd title={`${mac ? 'Command' : 'Control'} and Enter make it larger`}>{mac ? 'Cmd' : 'Ctrl'} Enter</kbd><span className="show-sr"> makes it larger</span></span>
      </div>

      <dl className="show-part wo-props" data-in="sheet">
        <div><dt>Lead</dt><dd>Mira Okafor</dd></div>
        <div><dt>Due</dt><dd>Fri 14 Nov</dd></div>
        <div><dt>Site</dt><dd>North pier</dd></div>
        <div><dt>Crew</dt><dd>3 people</dd></div>
      </dl>

      <fieldset className="show-part wo-checks" data-in="sheet">
        <legend>Checklist<span>{done} of {CHECKS.length}</span></legend>
        {CHECKS.map((label, index) => (
          <label key={label}>
            <input type="checkbox" checked={checks[index] === true} onChange={(event) => setChecks((list) => list.map((value, at) => (at === index ? event.target.checked : value)))} />
            <span className="wo-box" aria-hidden="true"><Check /></span>
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="show-part wo-log" data-in="sheet">
        <p className="wo-log-head">Activity</p>
        <p>Mira moved this to In progress</p>
        <p>Dan logged the 4 cm offset</p>
      </div>
    </div>
  );
});

interface Held {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** Two names for the held shape, taken in turn, so that every move is a new request. */
  flip: 0 | 1;
  aim: Layout;
}

interface Hold {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  width: number;
  height: number;
  radius: number;
  started: boolean;
  /** At least one request has gone out for this hold. */
  placed: boolean;
  origin: Layout;
  aim: Layout;
  flip: 0 | 1;
  requests: number;
  frame: number;
  places: Array<{ id: Layout; box: PlanBox }>;
}

interface Told {
  interruptions: number;
  afterStress: boolean;
  stressed: boolean;
  /** The last hold: how many requests it made, and the speed the engine carried out of it. */
  drag: { requests: number; speed: number; landed: Layout } | null;
}

export interface ShowpieceProps {
  /** Keep the layout and the spring in the address, and offer a link to them. */
  linked?: boolean;
  /** Opens the list of keyboard shortcuts, when the page has one. */
  onHelp?: () => void;
}

export function Showpiece({ linked = false, onHelp }: ShowpieceProps) {
  const [initial] = useState<ShowState>(() => parseState(linked ? window.location.search : ''));
  const [startedFromLink] = useState(() => linked && serializeState(initial) !== '');
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [spring, setSpring] = useState<SpringSetting>(initial.spring);
  const [rate, setRate] = useState(initial.rate);
  const [mode, setMode] = useState<Mode>(startedFromLink ? 'yours' : 'idle');
  const [stress, setStress] = useState(false);
  const [held, setHeld] = useState<Held | null>(null);
  const [reduced, setReduced] = useState(false);
  const [mac, setMac] = useState(false);
  const [touch, setTouch] = useState(false);
  const [told, setTold] = useState<Told>({ interruptions: 0, afterStress: false, stressed: false, drag: null });
  const [sameNode, setSameNode] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  /** True for the first second, while the sheet draws itself in. */
  const [fresh, setFresh] = useState(true);
  /**
   * The sheet renders in three steps, a frame apart: the plan, then the panel, then the spring.
   * Each is a task of its own, so the first screen never holds a slow phone up, and the stage
   * is still arriving while they happen.
   */
  const [step, setStep] = useState(0);

  const stage = useRef<HTMLElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLOutputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const firstTitleNode = useRef<HTMLInputElement | null>(null);
  const trace = useRef<ReturnType<typeof createTrace> | null>(null);
  const requestsOut = useRef<HTMLElement>(null);
  const interruptedOut = useRef<HTMLElement>(null);
  const focusOut = useRef<HTMLElement>(null);
  const caretOut = useRef<HTMLElement>(null);

  const moving = useRef(false);
  const visible = useRef(true);
  const counts = useRef({ requests: 0, interruptions: 0 });
  const previous = useRef<Layout>(nextLayout(initial.layout));
  const shownBefore = useRef<Layout>(initial.layout);
  const hold = useRef<Hold | null>(null);
  /** Set when a hold ends, so that the next move reports the velocity it started with. */
  const released = useRef<{ requests: number; landed: Layout } | null>(null);
  const latest = useRef({ layout, mode, stress, spring, rate });
  latest.current = { layout, mode, stress, spring, rate };

  const writeCounts = () => {
    if (requestsOut.current) requestsOut.current.textContent = count(counts.current.requests);
    if (interruptedOut.current) interruptedOut.current.textContent = count(counts.current.interruptions);
  };

  const onTrace = useCallback((event: TraceEvent) => {
    if (event.type === 'request') {
      if (latest.current.mode === 'yours') {
        counts.current.requests += 1;
        if (moving.current) counts.current.interruptions += 1;
        if (hold.current) hold.current.requests += 1;
        writeCounts();
      }
      moving.current = true;
      trace.current?.kick();
    } else if (event.type === 'retarget') {
      moving.current = true;
      trace.current?.kick();
      if (event.reason === 'shape' && released.current) {
        // The move out of a hold starts with whatever velocity the engine already had.
        const { requests, landed } = released.current;
        released.current = null;
        setTold((value) => ({ ...value, drag: { requests, speed: travelSpeed(event.velocity), landed } }));
      }
    } else if (event.type === 'settle' || event.type === 'snap') {
      if (event.type === 'snap' && released.current) {
        const { requests, landed } = released.current;
        released.current = null;
        setTold((value) => ({ ...value, drag: { requests, speed: 0, landed } }));
      }
      if (event.type === 'settle') {
        moving.current = false;
        if (!hold.current) {
          setTold((value) => (value.interruptions === counts.current.interruptions ? value : { ...value, interruptions: counts.current.interruptions }));
          setSameNode(firstTitleNode.current !== null && firstTitleNode.current === titleField.current && titleField.current.isConnected);
        }
      }
    }
  }, []);

  const takeOver = useCallback(() => {
    if (latest.current.mode === 'yours') return;
    setMode('yours');
    setAnnouncement('The panel is yours.');
  }, []);

  const choose = useCallback((next: Layout) => {
    takeOver();
    setStress(false);
    setTold((value) => (value.afterStress || value.drag ? { ...value, afterStress: false, drag: null } : value));
    setLayout(next);
  }, [takeOver]);

  const toggleStress = useCallback(() => {
    takeOver();
    const on = latest.current.stress;
    setAnnouncement(on ? 'Interruptions stopped.' : 'Interrupting the panel.');
    if (on) setTold({ interruptions: counts.current.interruptions, afterStress: true, stressed: true, drag: null });
    else setTold((value) => (value.drag ? { ...value, drag: null } : value));
    setStress(!on);
  }, [takeOver]);

  const onSpring = useCallback((next: SpringSetting, settled: boolean) => {
    setMode('yours');
    setSpring(next);
    // Letting go of a setting plays one move with it, there and back on the next change.
    if (settled && !latest.current.stress) {
      window.requestAnimationFrame(() => setLayout(previous.current));
    }
  }, []);

  const onRate = useCallback((next: number) => {
    setMode('yours');
    setRate(next);
  }, []);

  const link = useCallback(() => `${window.location.origin}${window.location.pathname}${serializeState({ layout: latest.current.layout, spring: latest.current.spring, rate: latest.current.rate })}`, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setFresh(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (step >= 2) return undefined;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setStep((current) => current + 1), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [step]);

  // The field that is there when the panel first renders is the one every later check is made against.
  useEffect(() => {
    if (step >= 1 && firstTitleNode.current === null) firstTitleNode.current = titleField.current;
  }, [step]);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    setTouch(matchMedia('(pointer: coarse)').matches);
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // The idle loop: a slow tour of the four layouts, until someone touches the stage.
  useEffect(() => {
    if (mode !== 'idle' || reduced) return undefined;
    let timer = 0;
    const step = () => {
      if (visible.current && document.visibilityState === 'visible') setLayout((current) => nextLayout(current));
      timer = window.setTimeout(step, IDLE_EVERY_MS);
    };
    timer = window.setTimeout(step, IDLE_FIRST_MS);
    return () => clearTimeout(timer);
  }, [mode, reduced]);

  // The stress control: a new request on a timer, each one landing on a panel still in flight.
  useEffect(() => {
    if (!stress) return undefined;
    const perSecond = reduced ? REDUCED_RATE : rate;
    const timer = window.setInterval(() => setLayout((current) => otherLayout(current, Math.random())), 1000 / perSecond);
    return () => clearInterval(timer);
  }, [stress, rate, reduced]);

  // Nothing runs while the stage is off screen or the tab is in the background.
  useEffect(() => {
    const node = stage.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
      if (!visible.current) setStress(false);
    }, { threshold: 0.05 });
    observer.observe(node);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') setStress(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // The long exposure of the panel, the readout that follows it, and the measured dimensions.
  useEffect(() => {
    const canvasNode = canvas.current;
    const fieldNode = field.current;
    if (!canvasNode || !fieldNode) return undefined;
    const carets = createCaretReader();
    let shownSize = '';
    const instance = createTrace({
      canvas: canvasNode,
      target: () => note.current,
      continuous: () => hold.current?.started === true || latest.current.stress,
      corners: () => !latest.current.stress,
      caret: () => {
        const active = document.activeElement;
        if (isTextField(active) && note.current?.contains(active)) return carets.read(active);
        return titleField.current ? carets.read(titleField.current, titleField.current.value.length) : null;
      },
      onFrame: (box, isMoving) => {
        const out = live.current;
        if (!out) return;
        const on = isMoving || hold.current?.started === true;
        if (on) {
          const size = `${Math.round(box.width)} × ${Math.round(box.height)}`;
          if (size !== shownSize) {
            shownSize = size;
            out.textContent = size;
          }
          out.style.translate = `${Math.round(box.x)}px ${Math.round(box.y > 26 ? box.y - 22 : box.y + box.height + 6)}px`;
        }
        if ((out.dataset['on'] === '') !== on) {
          if (on) out.dataset['on'] = '';
          else delete out.dataset['on'];
        }
      },
    });
    trace.current = instance;
    const sizes = () => {
      instance.resize();
      for (const slot of fieldNode.querySelectorAll<HTMLElement>('[data-slot]')) {
        const width = slot.querySelector('[data-measure="width"]');
        const height = slot.querySelector('[data-measure="height"]');
        if (width) width.textContent = String(slot.offsetWidth);
        if (height) height.textContent = String(slot.offsetHeight);
      }
    };
    const observer = new ResizeObserver(sizes);
    observer.observe(fieldNode);
    return () => {
      observer.disconnect();
      instance.destroy();
      carets.destroy();
      trace.current = null;
    };
  }, []);

  // A change of theme changes the ink, so the drawing reads its colors again.
  useEffect(() => {
    // It reads on the next frame, after the browser has laid the new theme out, so the read forces nothing.
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => trace.current?.resize());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-q-theme', 'data-q-recipe'] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // The layout before this one is remembered, so that letting go of a spring setting can go back to it.
  // A field that is not part of the new layout cannot keep focus, so the title takes it.
  useLayoutEffect(() => {
    if (shownBefore.current !== layout) {
      previous.current = shownBefore.current;
      shownBefore.current = layout;
    }
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !note.current?.contains(active)) return;
    const part = active.closest<HTMLElement>('[data-in]');
    if (part && !part.dataset['in']?.split(' ').includes(layout)) titleField.current?.focus({ preventScroll: true });
  }, [layout]);

  // The address follows the visitor's own settings, and never the idle loop or the stress run.
  useEffect(() => {
    if (!linked || mode !== 'yours' || stress) return;
    const search = serializeState({ layout, spring, rate }, window.location.search);
    if (search !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  }, [linked, mode, stress, layout, spring, rate]);

  useEffect(() => {
    const update = () => {
      const element = document.activeElement;
      const inside = element instanceof HTMLElement && note.current?.contains(element) === true;
      const name = inside ? (element.dataset['field'] ?? 'Checklist') : 'None';
      if (focusOut.current) focusOut.current.textContent = name;
      if (caretOut.current) {
        if (inside && isTextField(element)) {
          const start = element.selectionStart ?? 0;
          const end = element.selectionEnd ?? start;
          caretOut.current.textContent = start === end ? `At ${start}` : `${start} to ${end}`;
        } else caretOut.current.textContent = 'None';
      }
    };
    update();
    document.addEventListener('selectionchange', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  /*
   * Holding the panel. Nothing here moves the element: each frame the pointer has moved, the
   * held shape gets a new place and the Surface gets a new request, so the panel follows the
   * hand on the engine's own spring. Letting go is one more request, for a layout this time,
   * and the engine starts it at the speed it already has.
   */
  const endHold = useCallback((land: boolean) => {
    const current = hold.current;
    if (!current) return;
    hold.current = null;
    cancelAnimationFrame(current.frame);
    if (!current.placed) return;
    const landed = land ? current.aim : current.origin;
    released.current = { requests: current.requests, landed };
    setHeld(null);
    setLayout(landed);
    setAnnouncement(`The panel is ${LAYOUT_NOUN[landed]}.`);
  }, []);

  useEffect(() => {
    const place = () => {
      const current = hold.current;
      const fieldNode = field.current;
      if (!current || !fieldNode) return;
      current.frame = 0;
      const bounds = fieldNode.getBoundingClientRect();
      const origin = holdOrigin({ x: current.x - bounds.left, y: current.y - bounds.top }, { fx: current.fx, fy: current.fy }, current, bounds);
      current.aim = aimLayout({ ...origin, width: current.width, height: current.height }, current.places, current.origin);
      current.flip = current.flip === 0 ? 1 : 0;
      current.placed = true;
      setHeld({ ...origin, width: current.width, height: current.height, radius: current.radius, flip: current.flip, aim: current.aim });
    };
    const onMove = (event: PointerEvent) => {
      const current = hold.current;
      if (!current || event.pointerId !== current.pointerId) return;
      current.x = event.clientX;
      current.y = event.clientY;
      if (!current.started) {
        if (Math.hypot(current.x - current.startX, current.y - current.startY) < HOLD_SLOP_PX) return;
        current.started = true;
        setStress(false);
        setTold((value) => ({ ...value, afterStress: false, drag: null }));
      }
      if (!current.frame) current.frame = requestAnimationFrame(place);
    };
    const onUp = (event: PointerEvent) => {
      if (hold.current && event.pointerId === hold.current.pointerId) endHold(event.type === 'pointerup');
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && hold.current?.started) {
        event.preventDefault();
        event.stopPropagation();
        endHold(false);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey, true);
      if (hold.current) cancelAnimationFrame(hold.current.frame);
      hold.current = null;
    };
  }, [endHold]);

  const onNotePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || hold.current) return;
    const target = event.target as HTMLElement;
    const grip = target.closest('.show-grip') !== null;
    // On a touch screen only the grip takes a hold, so the page still scrolls under a finger.
    if (!grip && (event.pointerType === 'touch' || target.closest('input, textarea, label, button, a, kbd') !== null)) return;
    const noteNode = note.current;
    const fieldNode = field.current;
    if (!noteNode || !fieldNode) return;
    const box = noteNode.getBoundingClientRect();
    const places = [...fieldNode.querySelectorAll<HTMLElement>('[data-slot]')].map((slot) => ({
      id: slot.dataset['slot'] as Layout,
      box: { x: slot.offsetLeft, y: slot.offsetTop, width: slot.offsetWidth, height: slot.offsetHeight },
    }));
    const home = places.find((item) => item.id === latest.current.layout)?.box ?? { x: 0, y: 0, width: box.width, height: box.height };
    const slot = fieldNode.querySelector<HTMLElement>(`[data-slot="${latest.current.layout}"]`);
    hold.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      fx: box.width > 0 ? Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1) : 0.5,
      fy: box.height > 0 ? Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1) : 0.5,
      width: home.width,
      height: home.height,
      radius: slot ? Number.parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 0 : 0,
      started: false,
      placed: false,
      origin: latest.current.layout,
      aim: latest.current.layout,
      flip: 0,
      requests: 0,
      frame: 0,
      places,
    };
  };

  /** Pressing the panel itself, away from a field, leaves focus and the selection as they are. */
  const onNoteMouseDown = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('input, textarea, label, a') === null) event.preventDefault();
  };

  const onPointerDownCapture = (_event: ReactPointerEvent) => takeOver();
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (!NOT_INPUT_KEYS.has(event.key)) takeOver();
  };
  const onFocusCapture = (event: FocusEvent) => {
    if (isTextField(event.target)) takeOver();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (isTextField(event.target) && note.current?.contains(event.target)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        choose(stepLayout(latest.current.layout, -1));
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        choose(stepLayout(latest.current.layout, 1));
      }
      return;
    }
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      toggleStress();
      return;
    }
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    const picked = LAYOUTS[index];
    if (picked) {
      event.preventDefault();
      choose(picked.id);
    }
  };

  const perSecond = reduced ? REDUCED_RATE : rate;
  // While it is held or being interrupted the panel has no one layout, so no layout is marked.
  const shown = stress || held ? null : layout;
  let status = `${touch ? 'Tap' : 'Click'} the title, start typing and change the layout before it lands`;
  if (held) status = 'Every move of your hand is one more request, so let go over any layout';
  else if (stress) status = `It is being interrupted ${perSecond} times a second, so keep typing`;
  else if (mode === 'idle' && !reduced) status = 'It tours its four layouts until you touch it, and then it is yours';
  else if (told.drag && told.drag.speed >= 40) status = `It left your hand at ${count(told.drag.speed)} px a second after ${count(told.drag.requests)} requests, and the engine carried that into ${LAYOUT_NOUN[told.drag.landed]}`;
  else if (told.drag) status = `That hold was ${count(told.drag.requests)} ${told.drag.requests === 1 ? 'request' : 'requests'} on one element, and it came to rest as ${LAYOUT_NOUN[told.drag.landed]}`;
  else if (told.afterStress && told.interruptions > 0) status = `That was ${count(told.interruptions)} interruptions on one element${sameNode ? ', and your text and caret never left it' : ''}`;
  else if (told.interruptions > 0) status = `${told.stressed ? 'It has' : 'You'} changed course ${count(told.interruptions)} ${told.interruptions === 1 ? 'time' : 'times'}${sameNode ? ' and the field kept your text' : ''}`;

  const planStyle = { '--q-surface-response': spring.response, '--q-surface-damping': spring.damping } as CSSProperties;
  const noteStyle = held
    ? ({ '--hold-x': `${held.x}px`, '--hold-y': `${held.y}px`, '--hold-w': `${held.width}px`, '--hold-h': `${held.height}px`, '--hold-r': `${held.radius}px`, '--q-surface-response': HOLD_SPRING.response, '--q-surface-damping': HOLD_SPRING.damping } as CSSProperties)
    : undefined;

  return (
    <section className="show" ref={stage} aria-label="One element in four layouts" data-testid="stage" data-mode={mode} data-stress={stress || undefined} data-held={held ? '' : undefined} data-fresh={fresh ? '' : undefined}
      onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={onKeyDownCapture} onFocusCapture={onFocusCapture} onKeyDown={onKeyDown}>
      <div className="show-frame">
        <div className="show-bar">
          <div className="show-seg" role="group" aria-label="Layout">
            {LAYOUTS.map((item, index) => (
              <button key={item.id} type="button" className="show-btn" aria-pressed={shown === item.id} aria-keyshortcuts={String(index + 1)} onMouseDown={keepFocus} onClick={() => choose(item.id)} data-testid={`layout-${item.id}`}>{item.label}</button>
            ))}
          </div>
          <span className="show-divider" aria-hidden="true" />
          <button type="button" className="show-btn show-stress" aria-pressed={stress} aria-keyshortcuts="I" onMouseDown={keepFocus} onClick={toggleStress} data-testid="stress">
            <span className="show-pulse" aria-hidden="true" />
            Interrupt
            <span className="show-per"><span aria-hidden="true">{perSecond}/s</span><span className="show-sr"> {perSecond} times a second</span></span>
          </button>
          <dl className="show-readout show-counts" aria-label="Requests so far">
            <div><dt>Requests</dt><dd ref={requestsOut} data-testid="requests">0</dd></div>
            <div><dt>Mid-move</dt><dd ref={interruptedOut} data-testid="interruptions">0</dd></div>
          </dl>
          {onHelp ? <button type="button" className="show-btn show-help" aria-label="Keyboard shortcuts" aria-keyshortcuts="?" onMouseDown={keepFocus} onClick={onHelp} data-testid="help">?</button> : null}
        </div>

        <div className="show-plan" ref={plan} style={planStyle}>
          <div className="show-field" ref={field}>
            <Marks shown={shown} aim={held?.aim ?? null} onChoose={choose} />
            <canvas className="show-trace" ref={canvas} aria-hidden="true" data-testid="trace" />
            <output className="show-live" ref={live} aria-hidden="true" data-testid="live-size" />

            {step >= 1 ? (
            <Surface className="show-note" shape={held ? `hold-${held.flip}` : layout} ref={note} onTrace={onTrace} style={noteStyle} role="group" aria-label="Work order 118" data-testid="note"
              onPointerDown={onNotePointerDown} onMouseDown={onNoteMouseDown}>
              <Body layout={layout} mac={mac} titleRef={titleField} />
              <span className="show-grip" aria-hidden="true" data-testid="grip"><svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="2" r="1.4" /><circle cx="8" cy="2" r="1.4" /><circle cx="2" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="2" cy="14" r="1.4" /><circle cx="8" cy="14" r="1.4" /></svg></span>
            </Surface>
            ) : null}
          </div>
        </div>

        <div className="show-block">
          <div className="show-says">
            <p className="show-status" data-testid="status">{status}</p>
            <dl className="show-readout" aria-label="Focus and caret">
              <div><dt>Focus</dt><dd ref={focusOut} data-testid="focus">None</dd></div>
              <div><dt>Caret</dt><dd ref={caretOut} data-testid="caret">None</dd></div>
              <div><dt>Field</dt><dd data-testid="same-node">{sameNode ? 'Same node' : 'Replaced'}</dd></div>
            </dl>
          </div>
          {step >= 2 ? <Bench spring={spring} rate={rate} reduced={reduced} onSpring={onSpring} onRate={onRate} link={linked ? link : null} /> : <div className="show-bench" aria-hidden="true" />}
        </div>
      </div>
      <p className="show-sr" role="status">{announcement}</p>
    </section>
  );
}
