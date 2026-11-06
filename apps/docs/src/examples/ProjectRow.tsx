import { Button, Field, Input, Inspector, Select, Timeline, useInspector, type InspectorTrace } from '@qbeka/react';
import { useRef, useState, type RefObject } from 'react';
import { OWNERS, STATUSES, type Project } from './projects-data';

export interface SaveOptions {
  /** Simulated network time, in milliseconds. */
  delay: number;
  /** Makes the next save fail, so the recovery path can be tried. */
  fail: boolean;
}

function fakeSave({ delay, fail }: SaveOptions) {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => (fail ? reject(new Error('The server did not respond.')) : resolve()), delay);
  });
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const formatBudget = (budget: string) => (/^\d+$/.test(budget) ? money.format(Number(budget)) : budget);

interface Revision {
  project: Project;
  note: string;
}

function Editor({ project, onChange, onArchive, saveOptions }: { project: Project; onChange: (next: Project) => void; onArchive?: () => void; saveOptions: SaveOptions }) {
  const { closeAfter, pending: closing } = useInspector();
  const [draft, setDraft] = useState(project);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: 'quiet' | 'error'; text: string; undo?: Project } | null>(null);
  const [details, setDetails] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([{ project, note: 'Created' }]);
  const [revision, setRevision] = useState(0);
  const budgetRef = useRef<HTMLInputElement>(null);

  const budgetInvalid = !/^\d+$/.test(draft.budget.trim());
  const nameInvalid = draft.name.trim() === '';
  const dirty = JSON.stringify(draft) !== JSON.stringify(project);

  const save = async () => {
    setSaving(true);
    setStatus({ tone: 'quiet', text: 'Saving…' });
    try {
      await fakeSave(saveOptions);
    } catch (error) {
      setSaving(false);
      setStatus({ tone: 'error', text: `Not saved. ${(error as Error).message} Your changes are still here. Try again.` });
      throw error;
    }
    const previous = project;
    setSaving(false);
    onChange(draft);
    setRevisions((list) => {
      setRevision(list.length);
      return [...list, { project: draft, note: `Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` }];
    });
    setStatus({ tone: 'quiet', text: 'Saved.', undo: previous });
  };

  const validate = () => {
    if (budgetInvalid) budgetRef.current?.focus();
    return !budgetInvalid && !nameInvalid;
  };

  const undo = (previous: Project) => {
    setDraft(previous);
    onChange(previous);
    setStatus({ tone: 'quiet', text: 'Change undone.' });
  };

  const atRevision = revisions[revision];

  return (
    <div className="ex-editor">
      <div className="ex-grid">
        <Field.Root invalid={nameInvalid} className="ex-span">
          <Field.Label>Name</Field.Label>
          <Input data-probe="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {nameInvalid ? <Field.Error match>Give the project a name.</Field.Error> : null}
        </Field.Root>
        <Field.Root>
          <Field.Label nativeLabel={false} render={<span />}>Owner</Field.Label>
          <Select items={OWNERS} value={draft.owner} onValueChange={(owner) => owner && setDraft({ ...draft, owner })} />
        </Field.Root>
        <Field.Root>
          <Field.Label nativeLabel={false} render={<span />}>Status</Field.Label>
          <Select items={STATUSES} value={draft.status} onValueChange={(next) => next && setDraft({ ...draft, status: next as Project['status'] })} />
        </Field.Root>
        <Field.Root invalid={budgetInvalid} className="ex-span">
          <Field.Label>Budget in dollars</Field.Label>
          <Input ref={budgetRef} inputMode="numeric" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} />
          {budgetInvalid ? <Field.Error match>Use whole dollars, with digits only. For example, 84000.</Field.Error> : <Field.Description>{formatBudget(draft.budget)}</Field.Description>}
        </Field.Root>
      </div>

      <Button variant="ghost" aria-expanded={details} onClick={() => setDetails((d) => !d)}>{details ? 'Hide details' : 'Show details'}</Button>
      {details ? (
        <div className="ex-details">
          <Field.Root>
            <Field.Label>Notes</Field.Label>
            <Input render={<textarea rows={3} />} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field.Root>
          <div>
            <p className="ex-label">Revision history</p>
            <Timeline
              label="Revision history"
              min={0}
              max={Math.max(revisions.length - 1, 1)}
              value={revision}
              onValueChange={setRevision}
              markers={revisions.map((r, i) => ({ value: i, label: r.note }))}
              formatValue={(v) => `Revision ${v + 1}`}
              rate={1}
            />
            <p className="ex-revision">
              {atRevision ? `${atRevision.note}. ${atRevision.project.name}, ${formatBudget(atRevision.project.budget)}.` : 'No revision here yet.'}{' '}
              {atRevision && revision < revisions.length - 1 ? <button type="button" className="ex-inline" onClick={() => setDraft(atRevision.project)}>Restore this revision</button> : null}
            </p>
          </div>
        </div>
      ) : null}

      <div className="ex-actions">
        <Button variant="primary" pending={saving} onClick={() => { if (validate()) save().catch(() => undefined); }}>Save</Button>
        <Button pending={closing} onClick={() => { if (validate()) void closeAfter(save()); }}>Save and close</Button>
        <Inspector.Close className="q-button" data-variant="ghost">Close</Inspector.Close>
        {onArchive ? <Button variant="danger" onClick={onArchive}>Archive</Button> : null}
        <p className={`ex-status${status?.tone === 'error' ? ' is-error' : ''}`} role="status">
          {status?.text ?? (dirty ? 'Unsaved changes.' : '')}{' '}
          {status?.undo ? <button type="button" className="ex-inline" onClick={() => undo(status.undo as Project)}>Undo</button> : null}
        </p>
      </div>
    </div>
  );
}

export interface ProjectRowProps {
  project: Project;
  onChange: (next: Project) => void;
  onArchive?: () => void;
  saveOptions: SaveOptions;
  defaultOpen?: boolean;
  onTrace?: (event: InspectorTrace) => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

export function ProjectRow({ project, onChange, onArchive, saveOptions, defaultOpen, onTrace, fallbackFocusRef }: ProjectRowProps) {
  const statusLabel = STATUSES.find((s) => s.value === project.status)?.label;
  return (
    <Inspector.Root sheet defaultOpen={defaultOpen} onTrace={onTrace} fallbackFocusRef={fallbackFocusRef} className="ex-row" data-testid={`project-${project.id}`}>
      <Inspector.Trigger>
        <span className="ex-row-name">{project.name}</span>
        <span className="ex-row-meta">{statusLabel}</span>
        <span className="ex-row-meta ex-row-budget">{formatBudget(project.budget)}</span>
        <span className="ex-row-meta">{project.due}</span>
        <svg className="ex-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" /></svg>
      </Inspector.Trigger>
      <Inspector.Panel label={`Edit ${project.name}`}>
        <Editor project={project} onChange={onChange} onArchive={onArchive} saveOptions={saveOptions} />
      </Inspector.Panel>
    </Inspector.Root>
  );
}
