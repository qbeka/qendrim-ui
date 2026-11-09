import { Surface, type TraceEvent } from '@qbeka/react/surface';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useCopy } from '../lib/useCopy';
import { createEcho } from './echo';
import { CURVE, DAMPING, LAYOUTS, PRESETS, RATE, RESPONSE, curvePath, nextLayout, otherLayout, overshoot, parseState, serializeState, springCss, stepLayout, type Layout, type ShowState, type SpringSetting } from './model';
import './showpiece.css';

type Mode = 'idle' | 'yours';

const IDLE_FIRST_MS = 1700;
const IDLE_EVERY_MS = 2900;
const REDUCED_RATE = 2;
const NOT_INPUT_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta']);
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const CHECKS = ['Isolate the old sensor', 'Fit the new float', 'Check it against the pier mark'];

/** Keeps focus where it is when a control is pressed, so a person can keep typing. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

const isTextField = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text');

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
      <div className="show-bench-head">
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

      <label className="show-slider">
        <span>Response</span>
        <output data-testid="response-out">{spring.response} ms</output>
        <input type="range" min={RESPONSE.min} max={RESPONSE.max} step={RESPONSE.step} value={spring.response} style={fill(spring.response, RESPONSE)} data-testid="response"
          onChange={(event) => onSpring({ ...spring, response: Number(event.target.value) }, false)}
          onPointerUp={() => onSpring(spring, true)} onKeyUp={(event) => { if (SLIDER_KEYS.has(event.key)) onSpring(spring, true); }} />
      </label>
      <label className="show-slider">
        <span>Damping</span>
        <output data-testid="damping-out">{spring.damping.toFixed(2)}</output>
        <input type="range" min={DAMPING.min} max={DAMPING.max} step={DAMPING.step} value={spring.damping} style={fill(spring.damping, DAMPING)} data-testid="damping"
          onChange={(event) => onSpring({ ...spring, damping: Number(event.target.value) }, false)}
          onPointerUp={() => onSpring(spring, true)} onKeyUp={(event) => { if (SLIDER_KEYS.has(event.key)) onSpring(spring, true); }} />
      </label>

      <div className="show-code">
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

      <label className="show-slider show-rate">
        <span>Interruptions</span>
        <output data-testid="rate-out">{reduced ? `${REDUCED_RATE} a second, reduced motion` : `${rate} a second`}</output>
        <input type="range" min={RATE.min} max={RATE.max} step={RATE.step} value={rate} style={fill(rate, RATE)} aria-disabled={reduced || undefined} data-testid="rate"
          onChange={(event) => { if (!reduced) onRate(Number(event.target.value)); }} />
      </label>
    </aside>
  );
});

export interface ShowpieceProps {
  /** Keep the layout and the spring in the address, and offer a link to them. */
  linked?: boolean;
}

export function Showpiece({ linked = false }: ShowpieceProps) {
  const [initial] = useState<ShowState>(() => parseState(linked ? window.location.search : ''));
  const [startedFromLink] = useState(() => linked && serializeState(initial) !== '');
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [spring, setSpring] = useState<SpringSetting>(initial.spring);
  const [rate, setRate] = useState(initial.rate);
  const [title, setTitle] = useState('Replace the north tide gauge');
  const [notes, setNotes] = useState('It has read 4 cm high since the storm. Swap the float, then check it against the pier mark at slack water.');
  const [checks, setChecks] = useState([true, false, false]);
  const [mode, setMode] = useState<Mode>(startedFromLink ? 'yours' : 'idle');
  const [stress, setStress] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mac, setMac] = useState(false);
  const [touch, setTouch] = useState(false);
  const [told, setTold] = useState({ interruptions: 0, afterStress: false, stressed: false });
  const [sameNode, setSameNode] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  const stage = useRef<HTMLElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const firstTitleNode = useRef<HTMLInputElement | null>(null);
  const echo = useRef<ReturnType<typeof createEcho> | null>(null);
  const requestsOut = useRef<HTMLElement>(null);
  const interruptedOut = useRef<HTMLElement>(null);
  const focusOut = useRef<HTMLElement>(null);
  const caretOut = useRef<HTMLElement>(null);

  const moving = useRef(false);
  const visible = useRef(true);
  const counts = useRef({ requests: 0, interruptions: 0 });
  const previous = useRef<Layout>(nextLayout(initial.layout));
  const latest = useRef({ layout, mode, stress, spring, rate });
  latest.current = { layout, mode, stress, spring, rate };

  const writeCounts = () => {
    if (requestsOut.current) requestsOut.current.textContent = String(counts.current.requests);
    if (interruptedOut.current) interruptedOut.current.textContent = String(counts.current.interruptions);
  };

  const onTrace = useCallback((event: TraceEvent) => {
    if (event.type === 'request') {
      if (latest.current.mode === 'yours') {
        counts.current.requests += 1;
        if (moving.current) counts.current.interruptions += 1;
        writeCounts();
      }
      moving.current = true;
      echo.current?.kick();
    } else if (event.type === 'retarget') {
      moving.current = true;
      echo.current?.kick();
    } else if (event.type === 'settle' || event.type === 'snap') {
      if (event.type === 'snap') echo.current?.kick();
      if (event.type === 'settle') {
        moving.current = false;
        setTold((value) => (value.interruptions === counts.current.interruptions ? value : { ...value, interruptions: counts.current.interruptions }));
        setSameNode(firstTitleNode.current !== null && firstTitleNode.current === titleField.current && titleField.current.isConnected);
      }
    }
  }, []);

  /** Any layout request goes through here, so the one before it is remembered. */
  const go = useCallback((next: Layout | ((current: Layout) => Layout)) => {
    setLayout((current) => {
      const target = typeof next === 'function' ? next(current) : next;
      if (target !== current) previous.current = current;
      return target;
    });
  }, []);

  const takeOver = useCallback(() => {
    if (latest.current.mode === 'yours') return;
    setMode('yours');
    setAnnouncement('The panel is yours.');
  }, []);

  const choose = (next: Layout) => {
    takeOver();
    setStress(false);
    setTold((value) => (value.afterStress ? { ...value, afterStress: false } : value));
    go(next);
  };

  const toggleStress = () => {
    takeOver();
    setStress((on) => {
      setAnnouncement(on ? 'Interruptions stopped.' : 'Interrupting the panel.');
      if (on) setTold({ interruptions: counts.current.interruptions, afterStress: true, stressed: true });
      return !on;
    });
  };

  const onSpring = useCallback((next: SpringSetting, settled: boolean) => {
    setMode('yours');
    setSpring(next);
    // Letting go of a setting plays one move with it, there and back on the next change.
    if (settled && !latest.current.stress) {
      window.requestAnimationFrame(() => go(previous.current));
    }
  }, [go]);

  const onRate = useCallback((next: number) => {
    setMode('yours');
    setRate(next);
  }, []);

  const link = useCallback(() => `${window.location.origin}${window.location.pathname}${serializeState({ layout: latest.current.layout, spring: latest.current.spring, rate: latest.current.rate })}`, []);

  useEffect(() => {
    firstTitleNode.current = titleField.current;
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
      if (visible.current && document.visibilityState === 'visible') go((current) => nextLayout(current));
      timer = window.setTimeout(step, IDLE_EVERY_MS);
    };
    timer = window.setTimeout(step, IDLE_FIRST_MS);
    return () => clearTimeout(timer);
  }, [mode, reduced, go]);

  // The stress control: a new request on a timer, each one landing on a panel still in flight.
  useEffect(() => {
    if (!stress) return undefined;
    const perSecond = reduced ? REDUCED_RATE : rate;
    const timer = window.setInterval(() => go((current) => otherLayout(current, Math.random())), 1000 / perSecond);
    return () => clearInterval(timer);
  }, [stress, rate, reduced, go]);

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

  // The drawing of where the panel has been, and the readouts that follow it.
  useEffect(() => {
    const canvasNode = canvas.current;
    const planNode = plan.current;
    if (!canvasNode || !planNode) return undefined;
    const instance = createEcho({
      canvas: canvasNode,
      target: () => note.current,
    });
    echo.current = instance;
    const sizes = () => {
      instance.resize();
      for (const slot of planNode.querySelectorAll<HTMLElement>('[data-slot]')) {
        const out = slot.querySelector('.show-slot-size');
        if (out) out.textContent = `${slot.offsetWidth} × ${slot.offsetHeight}`;
      }
    };
    const observer = new ResizeObserver(sizes);
    observer.observe(planNode);
    return () => {
      observer.disconnect();
      instance.destroy();
      echo.current = null;
    };
  }, []);

  // A field that is not part of the new layout cannot keep focus, so the title takes it.
  useLayoutEffect(() => {
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

  const onPointerDownCapture = (_event: PointerEvent) => takeOver();
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
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    const picked = LAYOUTS[index];
    if (picked) {
      event.preventDefault();
      choose(picked.id);
    }
  };

  const perSecond = reduced ? REDUCED_RATE : rate;
  // While it is being interrupted the panel has no one layout, so no layout is marked.
  const shown = stress ? null : layout;
  let status = `${touch ? 'Tap' : 'Click'} the title, start typing and change the layout before it lands`;
  if (stress) status = `It is being interrupted ${perSecond} times a second, so keep typing`;
  else if (mode === 'idle' && !reduced) status = 'It tours its four layouts until you touch it, and then it is yours';
  else if (told.afterStress && told.interruptions > 0) status = `That was ${told.interruptions.toLocaleString('en-US')} interruptions on one element${sameNode ? ', and your text and caret never left it' : ''}`;
  else if (told.interruptions > 0) status = `${told.stressed ? 'It has' : 'You'} changed course ${told.interruptions.toLocaleString('en-US')} ${told.interruptions === 1 ? 'time' : 'times'}${sameNode ? ' and the field kept your text' : ''}`;

  const planStyle = { '--q-surface-response': spring.response, '--q-surface-damping': spring.damping } as CSSProperties;

  return (
    <section className="show" ref={stage} aria-label="One element in four layouts" data-testid="stage" data-mode={mode} data-stress={stress || undefined}
      onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={onKeyDownCapture} onFocusCapture={onFocusCapture} onKeyDown={onKeyDown}>
      <div className="show-frame">
      <div className="show-bar">
        <div className="show-seg" role="group" aria-label="Layout">
          {LAYOUTS.map((item, index) => (
            <button key={item.id} type="button" className="show-btn" aria-pressed={shown === item.id} aria-keyshortcuts={String(index + 1)} onMouseDown={keepFocus} onClick={() => choose(item.id)} data-testid={`layout-${item.id}`}>{item.label}</button>
          ))}
        </div>
        <span className="show-divider" aria-hidden="true" />
        <button type="button" className="show-btn show-stress" aria-pressed={stress} onMouseDown={keepFocus} onClick={toggleStress} data-testid="stress">
          <span className="show-pulse" aria-hidden="true" />
          Interrupt
          <span className="show-per"><span aria-hidden="true">{perSecond}/s</span><span className="show-sr"> {perSecond} times a second</span></span>
        </button>
        <dl className="show-readout show-counts" aria-label="Requests so far">
          <div><dt>Requests</dt><dd ref={requestsOut} data-testid="requests">0</dd></div>
          <div><dt>Mid-move</dt><dd ref={interruptedOut} data-testid="interruptions">0</dd></div>
        </dl>
      </div>

      <div className="show-plan" ref={plan} style={planStyle}>
        <div className="show-field">
          {LAYOUTS.map((item) => (
            <button key={item.id} type="button" tabIndex={-1} aria-hidden="true" className="show-slot" data-slot={item.id} data-here={shown === item.id || undefined} onMouseDown={keepFocus} onClick={() => choose(item.id)}>
              <span className="show-slot-tag"><span className="show-slot-name">{item.label}</span><span className="show-slot-size" /></span>
            </button>
          ))}
          <canvas className="show-echo" ref={canvas} aria-hidden="true" data-testid="echo" />

          <Surface className="show-note" shape={layout} ref={note} onTrace={onTrace} role="group" aria-label="Work order 118" data-testid="note">
            <div className="show-note-body">
              <span className="show-ring" aria-hidden="true" />
              <input ref={titleField} className="show-title" type="text" aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} data-field="Title" data-testid="title" autoComplete="off" spellCheck={false} enterKeyHint="done" />
              <textarea className="show-text" aria-label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} data-field="Notes" data-testid="notes" spellCheck={false} rows={1} />

              <div className="show-part show-meta" data-in="row">
                <span>Fri 14 Nov</span>
                <span className="show-avatar" aria-label="Mira Okafor" role="img">MO</span>
              </div>

              <div className="show-part show-foot" data-in="card">
                <span className="show-avatar" aria-hidden="true">MO</span>
                <span className="show-foot-name">Mira Okafor</span>
                <span className="show-foot-due">Fri 14 Nov</span>
              </div>

              <dl className="show-part show-side" data-in="editor">
                <div><dt>Status</dt><dd><span className="show-ring show-ring-small" aria-hidden="true" />In progress</dd></div>
                <div><dt>Lead</dt><dd><span className="show-avatar show-avatar-small" aria-hidden="true">MO</span>Mira Okafor</dd></div>
                <div><dt>Due</dt><dd>Fri 14 Nov</dd></div>
                <div><dt>Site</dt><dd>North pier</dd></div>
              </dl>
              <p className="show-part show-keys" data-in="editor"><kbd>Esc</kbd> makes it smaller and <kbd>{mac ? 'Cmd' : 'Ctrl'}</kbd> <kbd>Enter</kbd> makes it larger</p>

              <dl className="show-part show-props" data-in="sheet">
                <div><dt>Status</dt><dd>In progress</dd></div>
                <div><dt>Lead</dt><dd>Mira Okafor</dd></div>
                <div><dt>Due</dt><dd>Fri 14 Nov</dd></div>
                <div><dt>Site</dt><dd>North pier</dd></div>
              </dl>

              <fieldset className="show-part show-checks" data-in="sheet">
                <legend>Checklist</legend>
                {CHECKS.map((label, index) => (
                  <label key={label}>
                    <input type="checkbox" checked={checks[index] === true} onChange={(event) => setChecks((list) => list.map((value, at) => (at === index ? event.target.checked : value)))} />
                    <span className="show-box" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <div className="show-part show-log" data-in="sheet">
                <p className="show-log-head">Activity</p>
                <p>Mira moved this to In progress</p>
                <p>Dan logged the 4 cm offset</p>
              </div>
            </div>
          </Surface>
        </div>
      </div>

      <div className="show-strip">
        <p className="show-status" data-testid="status">{status}</p>
        <dl className="show-readout" aria-label="Focus and caret">
          <div><dt>Focus</dt><dd ref={focusOut} data-testid="focus">None</dd></div>
          <div><dt>Caret</dt><dd ref={caretOut} data-testid="caret">None</dd></div>
          <div><dt>Field</dt><dd data-testid="same-node">{sameNode ? 'Same node' : 'Replaced'}</dd></div>
        </dl>
      </div>

      <Bench spring={spring} rate={rate} reduced={reduced} onSpring={onSpring} onRate={onRate} link={linked ? link : null} />
      </div>
      <p className="show-sr" role="status">{announcement}</p>
    </section>
  );
}
