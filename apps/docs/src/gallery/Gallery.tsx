import { ActionBar } from '@qbeka/react/actionbar';
import { Input } from '@qbeka/react/input';
import { Inspector, useInspector } from '@qbeka/react/inspector';
import { Surface } from '@qbeka/react/surface';
import { Timeline } from '@qbeka/react/timeline';
import { useState, type ReactNode } from 'react';
import { useCopy } from '../lib/useCopy';
import { USAGE } from './usage';
import './gallery.css';

const SHAPES = [
  { value: 'chip', label: 'Chip' },
  { value: 'bar', label: 'Bar' },
  { value: 'card', label: 'Card' },
] as const;

function SurfaceSpecimen() {
  const [shape, setShape] = useState<(typeof SHAPES)[number]['value']>('chip');
  return (
    <div className="g-specimen">
      <div className="g-switch" role="group" aria-label="Shape">
        {SHAPES.map((item) => (
          <button key={item.value} className="g-control" type="button" aria-pressed={shape === item.value} onClick={() => setShape(item.value)}>{item.label}</button>
        ))}
      </div>
      <div className="g-shapes">
        <Surface className="g-shape" shape={shape} data-testid="g-shape"><span>One element</span></Surface>
      </div>
    </div>
  );
}

const SAVE_MS = 1400;

function SaveNote() {
  const { closeAfter, pending } = useInspector();
  const [note, setNote] = useState('Check the north pilings first.');
  const [saved, setSaved] = useState<boolean | null>(null);
  const save = () => {
    setSaved(null);
    // Stands in for a slow request, so that there is time to change your mind.
    const work = new Promise((resolve) => { setTimeout(resolve, SAVE_MS); });
    void closeAfter(work).then(setSaved);
  };
  let hint = 'The save is simulated, and typing during it keeps the panel open';
  if (pending) hint = 'Saving now, and typing keeps it open';
  else if (saved === false) hint = 'It saved and stayed open because you kept typing';
  return (
    <div className="g-note">
      <label className="g-field">Note<Input value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" /></label>
      <div className="g-note-end">
        <button className="g-control g-primary" type="button" aria-busy={pending || undefined} onClick={() => { if (!pending) save(); }}>Save and close</button>
        <p role="status">{hint}</p>
      </div>
    </div>
  );
}

function InspectorSpecimen() {
  return (
    <div className="g-specimen">
      <Inspector.Root className="g-row">
        <Inspector.Trigger><span>Pier survey</span><span className="g-muted">2 notes</span></Inspector.Trigger>
        <Inspector.Panel label="Edit Pier survey"><SaveNote /></Inspector.Panel>
      </Inspector.Root>
    </div>
  );
}

const HISTORY = [
  { day: 3, text: 'Budget approved at $1,200,000.' },
  { day: 11, text: 'Survey paid: $84,000.' },
  { day: 19, text: 'Budget raised to $1,350,000.' },
  { day: 27, text: 'Dredging moved to March.' },
];

function TimelineSpecimen() {
  const [day, setDay] = useState(11);
  const event = HISTORY.reduce<(typeof HISTORY)[number] | null>((found, item) => (item.day <= day ? item : found), null);
  return (
    <div className="g-specimen">
      <p className="g-event" aria-live="polite">{event ? event.text : 'Nothing yet this month.'}</p>
      <Timeline label="Budget history" min={1} max={31} value={day} onValueChange={setDay} markers={HISTORY.map((item) => ({ value: item.day, label: item.text }))} formatValue={(value) => `Day ${value}`} />
    </div>
  );
}

const RECEIPTS = [
  { id: 'r1', name: 'Tide tables', amount: '$240' },
  { id: 'r2', name: 'Survey drone hire', amount: '$1,180' },
  { id: 'r3', name: 'Site lunch', amount: '$96' },
];

function ActionBarSpecimen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  return (
    <div className="g-specimen g-receipts">
      <ul>
        {RECEIPTS.map((receipt) => (
          <li key={receipt.id}>
            <label>
              <input type="checkbox" checked={selected.includes(receipt.id)} onChange={() => toggle(receipt.id)} />
              <span>{receipt.name}</span>
              <span className="g-muted">{approved.includes(receipt.id) ? 'Approved' : receipt.amount}</span>
            </label>
          </li>
        ))}
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
        <p className="g-more">{more}</p>
        <button className="g-control g-copy" type="button" onClick={copy} aria-label={`Copy the ${name} example`}>
          <span data-on={state === 'idle' || undefined}>Copy</span>
          <span data-on={state === 'copied' || undefined}>Copied</span>
          <span data-on={state === 'failed' || undefined}>Failed</span>
        </button>
      </div>
    </div>
  );
}

const ENTRIES = [
  { slug: 'surface', name: 'Surface', text: 'One element that moves between your CSS layouts, so press another shape before it lands', specimen: <SurfaceSpecimen />, code: USAGE.surface },
  { slug: 'inspector', name: 'Inspector', text: 'A row that opens into an editor, where a close waiting on a save gives way to newer typing', specimen: <InspectorSpecimen />, code: USAGE.inspector },
  { slug: 'timeline', name: 'Timeline', text: 'A keyboard transport with markers for moving through a history', specimen: <TimelineSpecimen />, code: USAGE.timeline },
  { slug: 'actionbar', name: 'ActionBar', text: 'Actions that appear with a selection and take no layout space, so the list never moves', specimen: <ActionBarSpecimen />, code: USAGE.actionbar },
];

/** Four working specimens, each next to the code that makes it. */
export function Gallery({ docsLink }: { docsLink: (slug: string, name: string) => ReactNode }) {
  return (
    <div className="g-gallery">
      {ENTRIES.map((entry) => (
        <article className="g-entry" key={entry.slug} data-testid={`specimen-${entry.slug}`}>
          <div className="g-side">
            <header>
              <h3>{entry.name}</h3>
              <p>{entry.text}</p>
            </header>
            {entry.specimen}
          </div>
          <div className="g-side">
            <Usage name={entry.name} code={entry.code} more={docsLink(entry.slug, entry.name)} />
          </div>
        </article>
      ))}
    </div>
  );
}
