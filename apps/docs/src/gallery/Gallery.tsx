import { ActionBar } from '@qbeka/react/actionbar';
import { Button } from '@qbeka/react/button';
import { Input } from '@qbeka/react/input';
import { Inspector, useInspector } from '@qbeka/react/inspector';
import { Surface } from '@qbeka/react/surface';
import { Timeline } from '@qbeka/react/timeline';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BUDGETS, SIZES, kilobytes } from '../figures/results';
import { useCopy } from '../lib/useCopy';
import { USAGE } from './usage';
import './gallery.css';

/* Surface: a focus timer that is a pill, a bar or a card, and keeps counting while it moves. */

const SHAPES = [
  { value: 'pill', label: 'Pill' },
  { value: 'bar', label: 'Bar' },
  { value: 'card', label: 'Card' },
] as const;
type Shape = (typeof SHAPES)[number]['value'];

const SESSION_SECONDS = 25 * 60;
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const PlayIcon = ({ running }: { running: boolean }) =>
  running ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5v7M8 2.5v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6a.4.4 0 00.6.34l6-3.8a.4.4 0 000-.68l-6-3.8a.4.4 0 00-.6.34z" fill="currentColor" /></svg>
  );

function SurfaceSpecimen() {
  const [shape, setShape] = useState<Shape>('card');
  const [left, setLeft] = useState(SESSION_SECONDS);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    endsAt.current = Date.now() + left * 1000;
    const timer = setInterval(() => {
      const next = Math.max(Math.round((endsAt.current - Date.now()) / 1000), 0);
      setLeft(next);
      if (next === 0) setRunning(false);
    }, 250);
    return () => clearInterval(timer);
    // The interval measures from the moment it starts, so it must not restart on each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggle = () => {
    if (left === 0) setLeft(SESSION_SECONDS);
    setRunning((on) => !on);
  };
  const reset = () => {
    setRunning(false);
    setLeft(SESSION_SECONDS);
  };
  const done = 1 - left / SESSION_SECONDS;
  const pristine = !running && left === SESSION_SECONDS;

  return (
    <div className="g-piece g-timer-piece">
      <div className="g-switch" role="group" aria-label="Timer shape">
        {SHAPES.map((item) => (
          <button key={item.value} className="g-control" type="button" aria-pressed={shape === item.value} onClick={() => setShape(item.value)}>{item.label}</button>
        ))}
      </div>
      <div className="g-timer-stage">
        <Surface className="g-timer" shape={shape} data-testid="g-shape" role="group" aria-label="Focus timer" data-running={running || undefined}>
          <div className="g-timer-body" style={{ '--done': done } as React.CSSProperties}>
            <span className="g-timer-dot" aria-hidden="true" />
            <span className="g-timer-digits" role="timer" aria-label={`${clock(left)} left`} data-testid="g-digits">{clock(left)}</span>
            <div className="g-timer-part" data-in="bar">
              <button type="button" className="g-timer-round" onClick={toggle} aria-label={running ? 'Pause the timer' : 'Start the timer'}><PlayIcon running={running} /></button>
              <span className="g-timer-label">Focus</span>
              <span className="g-timer-track" aria-hidden="true" />
            </div>
            <div className="g-timer-part" data-in="card">
              <span className="g-timer-label">Focus session</span>
              <span className="g-timer-track" aria-hidden="true" />
              <div className="g-timer-actions">
                <button type="button" className="g-timer-button" onClick={toggle} data-testid="g-timer-toggle"><PlayIcon running={running} />{running ? 'Pause' : left === 0 ? 'Again' : 'Start'}</button>
                <button type="button" className="g-timer-button g-timer-quiet" onClick={() => { if (!pristine) reset(); }} aria-disabled={pristine || undefined}>Reset</button>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

/* Inspector: a crew list where each row opens into its own editor. */

const CREW = [
  { id: 'mira', name: 'Mira Okafor', role: 'Site lead', initials: 'MO', note: 'Check the north pilings first.' },
  { id: 'dan', name: 'Dan Hollis', role: 'Surveyor', initials: 'DH', note: 'Bring the long staff for the gauge.' },
  { id: 'yuki', name: 'Yuki Tanaka', role: 'Electrician', initials: 'YT', note: 'Signal box is locked until nine.' },
];

const SAVE_MS = 1400;

function CrewEditor({ person }: { person: (typeof CREW)[number] }) {
  const { closeAfter, pending } = useInspector();
  const [note, setNote] = useState(person.note);
  const [saved, setSaved] = useState<boolean | null>(null);
  const save = () => {
    setSaved(null);
    // Stands in for a slow request, so that there is time to change your mind.
    const work = new Promise((resolve) => { setTimeout(resolve, SAVE_MS); });
    void closeAfter(work).then(setSaved);
  };
  let hint = 'The save is simulated, and typing during it keeps the row open';
  if (pending) hint = 'Saving now, and typing keeps it open';
  else if (saved === false) hint = 'It saved and stayed open because you kept typing';
  return (
    <div className="g-crew-editor">
      <label className="g-field">Note<Input value={note} onChange={(event) => setNote(event.target.value)} autoComplete="off" /></label>
      <div className="g-crew-end">
        <Button variant="primary" pending={pending} onClick={save}>Save and close</Button>
        <p role="status">{hint}</p>
      </div>
    </div>
  );
}

function InspectorSpecimen() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="g-piece g-crew">
      {CREW.map((person) => (
        <Inspector.Root key={person.id} className="g-crew-row" open={open === person.id} onOpenChange={(next) => setOpen((current) => (next ? person.id : current === person.id ? null : current))}>
          <Inspector.Trigger>
            <span className="g-avatar" aria-hidden="true">{person.initials}</span>
            <span className="g-crew-name">{person.name}</span>
            <span className="g-muted">{person.role}</span>
            <svg className="g-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Inspector.Trigger>
          <Inspector.Panel label={`Edit ${person.name}`}><CrewEditor person={person} /></Inspector.Panel>
        </Inspector.Root>
      ))}
    </div>
  );
}

/* Timeline: a month of budget changes, scrubbed by day. */

const HISTORY = [
  { day: 1, amount: 1_100_000, text: 'Opened at $1,100,000' },
  { day: 3, amount: 1_200_000, text: 'Approved at $1,200,000' },
  { day: 11, amount: 1_116_000, text: 'Survey paid, $84,000' },
  { day: 19, amount: 1_266_000, text: 'Raised by $150,000' },
  { day: 27, amount: 1_221_000, text: 'Dredging deposit, $45,000' },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const CHART = { width: 300, height: 64, low: 1_050_000, high: 1_300_000 };
const chartX = (day: number) => ((day - 1) / 30) * CHART.width;
const chartY = (amount: number) => CHART.height - ((amount - CHART.low) / (CHART.high - CHART.low)) * CHART.height;

/** A stepped line: the budget holds its value until the next change. */
function stepPath(until: number) {
  let d = '';
  let last = HISTORY[0] as (typeof HISTORY)[number];
  for (const point of HISTORY) {
    if (point.day > until) break;
    d += d === '' ? `M${chartX(point.day).toFixed(1)} ${chartY(point.amount).toFixed(1)}` : `H${chartX(point.day).toFixed(1)}V${chartY(point.amount).toFixed(1)}`;
    last = point;
  }
  return { d: `${d}H${chartX(until).toFixed(1)}`, last };
}

function TimelineSpecimen() {
  const [day, setDay] = useState(19);
  const { d, last } = stepPath(day);
  const whole = stepPath(31).d;
  return (
    <div className="g-piece g-budget">
      <div className="g-budget-head">
        <p className="g-muted">Harbor rebuild budget</p>
        <p className="g-budget-amount" data-testid="g-amount">{money.format(last.amount)}</p>
        <p className="g-budget-event" aria-live="polite">{last.text}, day {last.day}</p>
      </div>
      <svg className="g-budget-chart" viewBox={`0 -4 ${CHART.width} ${CHART.height + 8}`} preserveAspectRatio="none" aria-hidden="true">
        <path className="g-chart-rest" d={whole} />
        <path className="g-chart-line" d={d} />
        <line className="g-chart-now" x1={chartX(day)} x2={chartX(day)} y1={-4} y2={CHART.height + 4} />
      </svg>
      <Timeline label="Budget history" min={1} max={31} value={day} onValueChange={setDay} markers={HISTORY.slice(1).map((item) => ({ value: item.day, label: item.text }))} formatValue={(value) => `Day ${value}`} />
    </div>
  );
}

/* ActionBar: receipts to approve, where selecting never moves the list. */

const RECEIPTS = [
  { id: 'r1', name: 'Tide tables', kind: 'Reference', amount: '$240' },
  { id: 'r2', name: 'Survey drone hire', kind: 'Equipment', amount: '$1,180' },
  { id: 'r3', name: 'Site lunch', kind: 'Meals', amount: '$96' },
  { id: 'r4', name: 'Pier mark paint', kind: 'Materials', amount: '$58' },
];

function ActionBarSpecimen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  return (
    <div className="g-piece g-receipts">
      <ul>
        {RECEIPTS.map((receipt) => {
          const isApproved = approved.includes(receipt.id);
          return (
            <li key={receipt.id} data-selected={selected.includes(receipt.id) || undefined}>
              <label>
                <input type="checkbox" checked={selected.includes(receipt.id)} onChange={() => toggle(receipt.id)} />
                <span className="g-check" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <span className="g-receipt-name">{receipt.name}</span>
                <span className="g-muted g-receipt-kind">{receipt.kind}</span>
                <span className="g-receipt-amount" data-approved={isApproved || undefined}>{isApproved ? 'Approved' : receipt.amount}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <ActionBar.Root open={selected.length > 0} label="Receipt actions" status={selected.length > 0 ? `${selected.length} selected` : ''}>
        <ActionBar.Action onClick={() => { setApproved((list) => [...new Set([...list, ...selected])]); setSelected([]); }}>Approve</ActionBar.Action>
        <ActionBar.Action onClick={() => setSelected([])}>Clear</ActionBar.Action>
      </ActionBar.Root>
    </div>
  );
}

function Usage({ name, code, more }: { name: string; code: string; more: ReactNode }) {
  const { state, copy } = useCopy(code);
  return (
    <div className="g-usage">
      <pre tabIndex={0} aria-label={`${name} usage example`}><code>{code}</code></pre>
      <div className="g-usage-end">
        <button className="g-control g-copy" type="button" onClick={copy} aria-label={`Copy the ${name} example`}>
          <span data-on={state === 'idle' || undefined}>Copy</span>
          <span data-on={state === 'copied' || undefined}>Copied</span>
          <span data-on={state === 'failed' || undefined}>Failed</span>
        </button>
        <p className="g-more">{more}</p>
      </div>
    </div>
  );
}

/** Gzipped bytes for one import, React excluded, from the final run. figures/results.test.ts checks them against the record. */
const kb = (bytes: number) => `${kilobytes(bytes)} KB`;
const bytesOf = (id: string) => SIZES.find((size) => size.id === id)?.bytes ?? 0;
const budgetOf = (name: string) => BUDGETS.find((budget) => budget.name === name)?.value ?? 0;

const ENTRIES = [
  {
    slug: 'surface', name: 'Surface', product: 'Tempo', scene: 'A focus timer',
    text: 'One element that moves between your CSS layouts, so press another shape before it lands',
    spec: [['Size', kb(bytesOf('surface'))], ['Built on', 'Its own spring engine, with no dependency'], ['Keys', 'None of its own']],
    specimen: <SurfaceSpecimen />, code: USAGE.surface,
  },
  {
    slug: 'inspector', name: 'Inspector', product: 'Roster', scene: 'A crew list',
    text: 'A row that opens into an editor, where a close waiting on a save gives way to newer typing',
    spec: [['Size', kb(bytesOf('inspector'))], ['Built on', 'Surface, and no Base UI Dialog'], ['Keys', 'Enter or Space opens, and Escape closes']],
    specimen: <InspectorSpecimen />, code: USAGE.inspector,
  },
  {
    slug: 'timeline', name: 'Timeline', product: 'Ledger', scene: 'A budget history',
    text: 'A keyboard transport with markers, for moving through a history',
    spec: [['Size', kb(budgetOf('Timeline import'))], ['Built on', 'Base UI Slider'], ['Keys', 'Arrows, Home and End, and [ and ] for markers']],
    specimen: <TimelineSpecimen />, code: USAGE.timeline,
  },
  {
    slug: 'actionbar', name: 'ActionBar', product: 'Receipts', scene: 'An approval queue',
    text: 'Actions that appear with a selection and take no layout space, so the list never moves',
    spec: [['Size', kb(budgetOf('ActionBar import'))], ['Built on', 'Base UI Toolbar and Surface'], ['Keys', 'Tab enters once, and arrows move']],
    specimen: <ActionBarSpecimen />, code: USAGE.actionbar,
  },
] as const;

function Product({ entry }: { entry: (typeof ENTRIES)[number] }) {
  return (
    <div className="g-product" data-product={entry.slug}>
      <p className="g-product-bar"><b>{entry.product}</b><span>{entry.scene}</span></p>
      <div className="g-specimen">{entry.specimen}</div>
    </div>
  );
}

/** One specimen on its own, for the top of a component's page in the docs. */
export function Specimen({ slug }: { slug: string }) {
  const entry = ENTRIES.find((item) => item.slug === slug);
  if (!entry) return null;
  return (
    <div className="g-sheet g-solo" data-testid={`specimen-${entry.slug}`}>
      <Product entry={entry} />
    </div>
  );
}

export const hasSpecimen = (slug: string) => ENTRIES.some((item) => item.slug === slug);

/** Four working specimens on one sheet, set like a type specimen: a number, the name, what it is made of, and the thing itself in use. */
export function Gallery({ docsLink }: { docsLink: (slug: string, name: string) => ReactNode }) {
  return (
    <div className="g-sheet">
      <div className="g-grid">
        {ENTRIES.map((entry, index) => (
          <article className="g-entry" key={entry.slug} data-testid={`specimen-${entry.slug}`} data-block="" data-cold="">
            <header className="g-entry-head">
              <p className="g-entry-no" aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>
              <h3>{entry.name}</h3>
              <dl className="g-entry-spec">
                <div><dt>Does</dt><dd>{entry.text}</dd></div>
                {entry.spec.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
              </dl>
            </header>
            <Product entry={entry} />
            <Usage name={entry.name} code={entry.code} more={docsLink(entry.slug, entry.name)} />
          </article>
        ))}
      </div>
    </div>
  );
}
