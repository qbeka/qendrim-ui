import { Input } from '@qbeka/react/input';
import { Inspector, type InspectorTrace } from '@qbeka/react/inspector';
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type FocusEvent } from 'react';
import { EXTRA_LABELS, ROWS, formatBudget, type Extra, type Row } from './data';
import { REDUCED_STEP_MS, SCRIPT, type ScriptStep } from './script';
import { createTrack } from './track';

type Mode = 'idle' | 'script' | 'handoff' | 'finished';
type Editable = 'name' | 'lead' | 'budget';

const LOG_LENGTH = 6;
const STATUS_HOLD_MS = 2600;
const NOT_INPUT_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta']);

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Keeps focus where it is when a toolbar button is pressed, so a person can keep typing. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

interface RowProps {
  row: Row;
  open: boolean;
  selected: boolean;
  quiet: boolean;
  extras: Extra[];
  onRequest: (id: string, open: boolean) => void;
  onEdit: (id: string, field: Editable, value: string) => void;
  onEditExtra: (id: string, key: number, value: string) => void;
  onRemoveExtra: (id: string, key: number) => void;
  onTrace: (id: string, event: InspectorTrace) => void;
}

/** One row. Its panel stays mounted when it closes, so every field keeps its node. */
const ProjectRow = memo(function ProjectRow({ row, open, selected, quiet, extras, onRequest, onEdit, onEditExtra, onRemoveExtra, onTrace }: RowProps) {
  const name = row.name.trim() || 'Untitled';
  return (
    <Inspector.Root open={open} onOpenChange={(next) => onRequest(row.id, next)} onTrace={(event) => onTrace(row.id, event)} className="row" data-row={row.id} data-selected={selected || undefined}>
      <Inspector.Trigger>
        <span className="row-name" data-empty={row.name.trim() === '' || undefined}>{name}</span>
        <span className="row-meta row-status">{row.status}</span>
        <span className="row-meta row-budget">{formatBudget(row.budget)}</span>
        <span className="row-meta row-due">{row.due}</span>
        <svg className="row-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" /></svg>
      </Inspector.Trigger>
      {/* A person gets focus in the first field on open. The script leaves focus alone. */}
      <Inspector.Panel label={`Edit ${name}`} initialFocus={quiet ? false : undefined}>
        <div className="editor">
          <label className="field field-wide">Name<Input value={row.name} onChange={(e) => onEdit(row.id, 'name', e.target.value)} data-field="Name" data-testid={`name-${row.id}`} autoComplete="off" /></label>
          <label className="field">Lead<Input value={row.lead} onChange={(e) => onEdit(row.id, 'lead', e.target.value)} data-field="Lead" autoComplete="off" /></label>
          <label className="field">Budget in dollars<Input value={row.budget} onChange={(e) => onEdit(row.id, 'budget', e.target.value)} data-field="Budget" inputMode="numeric" autoComplete="off" /></label>
          {extras.map((extra) => (
            <div className="field field-wide extra" key={extra.key} data-testid="extra">
              <label className="field">{extra.label}<Input value={extra.value} onChange={(e) => onEditExtra(row.id, extra.key, e.target.value)} data-field={extra.label} autoComplete="off" /></label>
              <button className="control" type="button" aria-label={`Remove ${extra.label}`} onClick={() => onRemoveExtra(row.id, extra.key)}>Remove</button>
            </div>
          ))}
          <div className="editor-end field-wide">
            <Inspector.Close className="control outline">Close</Inspector.Close>
          </div>
        </div>
      </Inspector.Panel>
    </Inspector.Root>
  );
});

export function Stage() {
  const [rows, setRows] = useState(ROWS);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState((ROWS[0] as Row).id);
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [narrow, setNarrow] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [interruptions, setInterruptions] = useState(0);
  const [requests, setRequests] = useState(0);
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const [focusName, setFocusName] = useState('None');
  const [sameNode, setSameNode] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  const scroller = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const marks = useRef<SVGPathElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const heightOut = useRef<HTMLElement>(null);
  const phaseOut = useRef<HTMLElement>(null);
  const caretOut = useRef<HTMLElement>(null);
  const track = useRef<ReturnType<typeof createTrack> | null>(null);

  const moving = useRef(new Set<string>());
  const timer = useRef(0);
  const nextKey = useRef(0);
  const nextLog = useRef(0);
  const firstNodes = useRef(new Map<string, Element>());
  const scriptAdded = useRef<{ id: string; key: number } | null>(null);
  const latest = useRef({ active, selected, rows, extras, mode });
  latest.current = { active, selected, rows, extras, mode };

  const note = useCallback((text: string) => {
    nextLog.current += 1;
    const id = nextLog.current;
    setLog((entries) => [...entries.slice(1 - LOG_LENGTH), { id, text }]);
  }, []);

  const rowName = (id: string) => latest.current.rows.find((row) => row.id === id)?.name.trim() || 'Untitled';

  const onTrace = useCallback((id: string, event: InspectorTrace) => {
    if (event.type === 'request') {
      if (moving.current.has(id)) {
        setInterruptions((n) => n + 1);
        track.current?.mark();
      }
      moving.current.add(id);
      setRequests((n) => n + 1);
      note(`Request ${event.generation}: ${event.shape === 'open' ? 'open' : 'close'} ${rowName(id)}`);
      track.current?.kick();
    } else if (event.type === 'retarget') {
      if (event.reason === 'content' || event.reason === 'viewport') {
        if (moving.current.has(id)) {
          setInterruptions((n) => n + 1);
          track.current?.mark();
        }
        note(event.reason === 'content' ? 'New target: content changed' : 'New target: width changed');
      }
      moving.current.add(id);
      track.current?.kick();
    } else if (event.type === 'settle') {
      moving.current.delete(id);
      if (event.result === 'committed') note(`Settled: ${event.shape}`);
      const field = document.querySelector(`[data-testid="name-${id}"]`);
      setSameNode(field !== null && firstNodes.current.get(id) === field);
    } else if (event.type === 'focus') {
      note(`Focus: ${event.target?.dataset['field'] ?? event.reason}`);
    }
  }, [note]);

  const request = useCallback((id: string, open: boolean) => {
    setSelected(id);
    setActive((current) => (open ? id : current === id ? null : current));
  }, []);

  const edit = useCallback((id: string, field: Editable, value: string) => {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }, []);

  const addExtra = useCallback((id: string) => {
    const present = latest.current.extras[id] ?? [];
    const label = EXTRA_LABELS.find((name) => !present.some((extra) => extra.label === name));
    if (!label) return null;
    nextKey.current += 1;
    const key = nextKey.current;
    setExtras((all) => ({ ...all, [id]: [...(all[id] ?? []), { key, label, value: '' }] }));
    return key;
  }, []);

  const editExtra = useCallback((id: string, key: number, value: string) => {
    setExtras((all) => ({ ...all, [id]: (all[id] ?? []).map((extra) => (extra.key === key ? { ...extra, value } : extra)) }));
  }, []);

  const removeExtra = useCallback((id: string, key: number) => {
    setExtras((all) => ({ ...all, [id]: (all[id] ?? []).filter((extra) => extra.key !== key) }));
  }, []);

  /** Ends the script at once. Whatever is on screen stays, and it now belongs to the visitor. */
  const stopScript = useCallback((next: Mode) => {
    clearTimeout(timer.current);
    scriptAdded.current = null;
    setMode(next);
  }, []);

  const takeOver = useCallback(() => {
    if (latest.current.mode !== 'script') return;
    stopScript('handoff');
    setAnnouncement('The script stopped. You have the controls.');
  }, [stopScript]);

  const runStep = useCallback((step: ScriptStep) => {
    const current = latest.current;
    if (step === 'open') request(current.selected, true);
    else if (step === 'close') setActive(null);
    else if (step === 'resize') setNarrow((n) => !n);
    else if (step === 'add') {
      const key = addExtra(current.selected);
      if (key !== null) scriptAdded.current = { id: current.selected, key };
    } else {
      const index = ROWS.findIndex((row) => row.id === current.selected);
      const next = ROWS[(index + 1) % ROWS.length] as Row;
      request(next.id, true);
      // The script clears up its own empty field. A field with text in it is left alone.
      const added = scriptAdded.current;
      if (added && current.extras[added.id]?.find((extra) => extra.key === added.key)?.value === '') removeExtra(added.id, added.key);
      scriptAdded.current = null;
    }
  }, [addExtra, removeExtra, request]);

  const playScript = () => {
    if (mode === 'script') {
      stopScript('idle');
      return;
    }
    setMode('script');
    setAnnouncement('Script running.');
    const queue = (index: number) => {
      const entry = SCRIPT[index];
      if (!entry) {
        stopScript('finished');
        setAnnouncement('Script finished.');
        return;
      }
      timer.current = window.setTimeout(() => {
        runStep(entry.step);
        queue(index + 1);
      }, reducedMotion() ? REDUCED_STEP_MS : entry.after);
    };
    queue(0);
  };

  const reset = () => {
    stopScript('idle');
    setRows(ROWS);
    setExtras({});
    setActive(null);
    setSelected((ROWS[0] as Row).id);
    setNarrow(false);
    setInterruptions(0);
    setRequests(0);
    setLog([]);
    track.current?.clear();
    setAnnouncement('Demo reset.');
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // A handoff is news for a moment. After that the sentence goes back to what the person is doing.
  useEffect(() => {
    if (mode !== 'handoff' && mode !== 'finished') return undefined;
    const id = setTimeout(() => setMode('idle'), STATUS_HOLD_MS);
    return () => clearTimeout(id);
  }, [mode]);

  useEffect(() => {
    for (const row of ROWS) {
      const field = document.querySelector(`[data-testid="name-${row.id}"]`);
      if (field) firstNodes.current.set(row.id, field);
    }
  }, []);

  useEffect(() => {
    const listNode = list.current;
    const scrollNode = scroller.current;
    const lineNode = line.current;
    const marksNode = marks.current;
    const headNode = head.current;
    if (!listNode || !scrollNode || !lineNode || !marksNode || !headNode) return undefined;

    /** Keeps the open panel in the list's view as it grows, and never pushes its top out. */
    const pin = () => {
      const panel = listNode.querySelector('[data-q-surface][data-shape="open"]');
      if (!panel) return;
      const box = panel.getBoundingClientRect();
      const view = scrollNode.getBoundingClientRect();
      const room = box.top - view.top - 8;
      const over = box.bottom + 8 - view.bottom;
      if (room < 0) scrollNode.scrollTop += room;
      else if (over > 0) scrollNode.scrollTop += Math.min(over, room);
    };

    const instance = createTrack({
      line: lineNode,
      marks: marksNode,
      head: headNode,
      list: listNode,
      onFrame: (height, still) => {
        if (heightOut.current) heightOut.current.textContent = `${Math.round(height)} px`;
        if (phaseOut.current) phaseOut.current.textContent = still ? 'Moving' : 'At rest';
        pin();
      },
    });
    track.current = instance;
    return () => {
      instance.destroy();
      track.current = null;
    };
  }, []);

  // Surface hears about window resizes. Here the column stands in for the window, so while a
  // panel is moving, a new column width is passed on in the same way. Height is ignored: it
  // changes on every frame of a move, because the panel itself is what makes the column tall.
  useEffect(() => {
    const node = column.current;
    if (!node) return undefined;
    let width = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize[0]?.inlineSize ?? width;
      if (next === width) return;
      width = next;
      if (node.querySelector('[data-q-surface][data-phase="moving"]')) window.dispatchEvent(new Event('resize'));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inspect) return undefined;
    const update = () => {
      const element = document.activeElement;
      if (caretOut.current) caretOut.current.textContent = element instanceof HTMLInputElement && element.dataset['field'] ? `${element.selectionStart ?? 0} to ${element.selectionEnd ?? 0}` : 'None';
    };
    update();
    document.addEventListener('selectionchange', update);
    document.addEventListener('focusin', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('focusin', update);
    };
  }, [inspect]);

  const fromScriptControl = (target: EventTarget) => target instanceof Element && target.closest('[data-script-control]') !== null;
  const onPointerDownCapture = (event: PointerEvent) => {
    if (!fromScriptControl(event.target)) takeOver();
  };
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (!NOT_INPUT_KEYS.has(event.key) && !fromScriptControl(event.target)) takeOver();
  };
  const onFocusCapture = (event: FocusEvent) => {
    const name = event.target instanceof HTMLElement ? event.target.dataset['field'] : undefined;
    setFocusName(name ?? 'None');
    if (name) takeOver();
  };
  const onBlurCapture = () => setFocusName('None');

  const scripted = mode === 'script';
  const target = active ?? selected;
  const open = active !== null;
  const extrasHere = extras[target] ?? [];
  const full = extrasHere.length >= EXTRA_LABELS.length;
  const pristine = rows === ROWS && Object.values(extras).every((list) => list.length === 0) && !active && !narrow && interruptions === 0;

  const pressOpen = () => {
    if (open) setActive(null);
    else request(target, true);
  };
  const pressAdd = () => {
    if (full) return;
    addExtra(target);
    if (!open) request(target, true);
  };

  let status = 'Open a row, start typing and close it before it lands';
  if (scripted) status = 'The script is running, and pressing anything hands the panel to you';
  else if (mode === 'handoff') status = 'The script stopped and left your text alone, so the panel is yours';
  else if (mode === 'finished') status = 'The script finished and the panel is yours';
  else if (interruptions > 0) status = `You changed course ${interruptions} ${interruptions === 1 ? 'time' : 'times'}${sameNode ? ' and the field kept your text' : ''}`;
  else if (open) status = 'Now change your mind while it moves';

  return (
    <section className="stage" aria-label="Project list demo" data-testid="stage" onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={onKeyDownCapture} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture} onInputCapture={takeOver}>
      <div className="toolbar" role="group" aria-label="Demo actions">
        <button className="control primary swap" type="button" onMouseDown={keepFocus} onClick={pressOpen} aria-expanded={open} data-testid="open">
          <span data-on={!open || undefined}>Open panel</span>
          <span data-on={open || undefined}>Close panel</span>
        </button>
        <button className="control" type="button" onMouseDown={keepFocus} onClick={pressAdd} aria-disabled={full || undefined} data-testid="add">Add content</button>
        <button className="control" type="button" onMouseDown={keepFocus} onClick={() => setNarrow((n) => !n)} aria-pressed={narrow} data-testid="resize">Resize</button>
        <button className="control" type="button" onMouseDown={keepFocus} onClick={() => setInspect((i) => !i)} aria-pressed={inspect} aria-controls="inspect-pane" data-testid="inspect">Inspect</button>
      </div>

      <div className="body" data-inspect={inspect || undefined}>
        <div className="scroller" ref={scroller}>
          <div className="column" ref={column} data-narrow={narrow || undefined}>
            <div className="list" ref={list}>
              {rows.map((row) => (
                <ProjectRow key={row.id} row={row} open={active === row.id} selected={target === row.id} quiet={scripted} extras={extras[row.id] ?? NO_EXTRAS} onRequest={request} onEdit={edit} onEditExtra={editExtra} onRemoveExtra={removeExtra} onTrace={onTrace} />
              ))}
            </div>
          </div>
        </div>

        <aside className="pane" id="inspect-pane" aria-label="Inspect" inert={!inspect}>
          <div className="pane-inner">
            <div className="pane-actions">
              <button className="control outline swap" type="button" data-script-control onMouseDown={keepFocus} onClick={playScript} data-testid="script">
                <span data-on={!scripted || undefined}>Play script</span>
                <span data-on={scripted || undefined}>Stop script</span>
              </button>
              <button className="control" type="button" onMouseDown={keepFocus} onClick={() => { if (!pristine) reset(); }} aria-disabled={pristine || undefined} data-testid="reset">Reset</button>
            </div>
            <dl className="readout">
              <div><dt>List height</dt><dd ref={heightOut}>Not sampled yet</dd></div>
              <div><dt>Panel</dt><dd ref={phaseOut}>At rest</dd></div>
              <div><dt>Requests</dt><dd data-testid="requests">{requests}</dd></div>
              <div><dt>Field</dt><dd data-testid="same-node">{sameNode ? 'Same node' : 'Replaced'}</dd></div>
              <div><dt>Focus</dt><dd>{focusName}</dd></div>
              <div><dt>Selection</dt><dd ref={caretOut}>None</dd></div>
            </dl>
            <ol className="log" aria-label="Recent events">
              {log.map((entry) => <li key={entry.id}>{entry.text}</li>)}
            </ol>
          </div>
        </aside>
      </div>

      <div className="strip">
        <p className="status" data-testid="status">{status}</p>
        <div className="trace" aria-hidden="true">
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none">
            <path className="trace-marks" ref={marks} />
            <path className="trace-line" ref={line} />
          </svg>
          <span className="trace-head" ref={head} data-on="false" />
        </div>
        <span className="live">Live</span>
      </div>
      <p className="sr-only" role="status">{announcement}</p>
    </section>
  );
}

const NO_EXTRAS: Extra[] = [];
