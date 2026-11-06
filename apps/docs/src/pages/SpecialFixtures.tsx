import { ActionBar, Button, Dialog, Inspector, Popover, Select, Surface, Tabs, Timeline, Tooltip, Input, Field } from '@qbeka/react';
import { useRef, useState, type CSSProperties } from 'react';

/** Test-only page. Each case is one situation from docs/CONTRACT.md that needs its own layout. */

function Long({ n = 30 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <p key={i} style={{ margin: 0, padding: '6px 0' }}>Row {i + 1}</p>)}</>;
}

function ShapeCase({ wrapper, label }: { wrapper: CSSProperties; label: string }) {
  const [shape, setShape] = useState('small');
  return (
    <div style={wrapper} data-testid={`case-${label}`}>
      <button type="button" data-testid={`toggle-${label}`} onClick={() => setShape((s) => (s === 'small' ? 'large' : 'small'))}>Toggle</button>
      <Surface data-testid={`surface-${label}`} shape={shape} className="sp-box"><p style={{ margin: 0 }}>Box</p></Surface>
    </div>
  );
}

function NestedScroll() {
  const [shape, setShape] = useState('small');
  return (
    <div>
      <button type="button" data-testid="toggle-scroll" onClick={() => setShape((s) => (s === 'small' ? 'large' : 'small'))}>Toggle</button>
      <div data-testid="scroller" style={{ height: 200, overflow: 'auto', border: '1px solid #ccc' }}>
        <Long n={12} />
        <Surface data-testid="surface-scroll" shape={shape} className="sp-box"><p style={{ margin: 0 }}>Box</p></Surface>
        <Long n={2} />
      </div>
    </div>
  );
}

function Controlled() {
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const triggerHost = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button type="button" ref={triggerHost} data-testid="modal-fallback">Fallback</button>
      <Inspector.Root modal open={open} onOpenChange={setOpen} fallbackFocusRef={triggerHost}>
        {removed ? null : <Inspector.Trigger data-testid="modal-trigger">Open modal</Inspector.Trigger>}
        <Inspector.Panel label="Modal review">
          <Field.Root><Field.Label>Amount</Field.Label><Input data-testid="modal-input" defaultValue="42.18" /></Field.Root>
          <Inspector.Close data-testid="modal-close">Close</Inspector.Close>
          <button type="button" data-testid="modal-remove-trigger" onClick={() => setRemoved(true)}>Remove trigger</button>
        </Inspector.Panel>
      </Inspector.Root>
      <button type="button" data-testid="outside-modal">Outside</button>
    </div>
  );
}

function NestedPopups() {
  const [escapes, setEscapes] = useState(0);
  return (
    <Inspector.Root defaultOpen onOpenChange={(o) => { if (!o) setEscapes((e) => e + 1); }} className="sp-inspector" data-testid="nested-inspector">
      <Inspector.Trigger data-testid="nested-trigger">Nested</Inspector.Trigger>
      <Inspector.Panel label="Nested popups">
        <Select aria-label="Choice" data-testid="nested-select" items={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} defaultValue="a" />
        <Popover.Root><Popover.Trigger data-testid="nested-popover">Popover</Popover.Trigger><Popover.Content title="Inside">Text</Popover.Content></Popover.Root>
        <output data-testid="nested-closes">{escapes}</output>
      </Inspector.Panel>
    </Inspector.Root>
  );
}

function Foundation() {
  const [day, setDay] = useState(5);
  return (
    <div>
      <Tabs.Root defaultValue="a"><Tabs.List aria-label="Sample"><Tabs.Tab value="a" data-testid="tab-a">A</Tabs.Tab><Tabs.Tab value="b" data-testid="tab-b">B</Tabs.Tab></Tabs.List><Tabs.Panel value="a">Panel A</Tabs.Panel><Tabs.Panel value="b">Panel B</Tabs.Panel></Tabs.Root>
      <Dialog.Root><Dialog.Trigger data-testid="dialog-trigger">Dialog</Dialog.Trigger><Dialog.Content title="Sample dialog"><Dialog.Close data-testid="dialog-close">Close</Dialog.Close></Dialog.Content></Dialog.Root>
      <Tooltip content="A hint"><Button data-testid="tooltip-trigger">Tip</Button></Tooltip>
      <Timeline label="Sample timeline" min={0} max={20} value={day} onValueChange={setDay} markers={[{ value: 2, label: 'Two' }, { value: 10, label: 'Ten' }, { value: 15, label: 'Fifteen' }]} rate={200} data-testid="timeline" />
      <output data-testid="timeline-value">{day}</output>
    </div>
  );
}

function ActionBarCase() {
  const [n, setN] = useState(0);
  const fallback = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={fallback} type="button" data-testid="bar-add" onClick={() => setN(n + 1)}>Add</button>
      <div data-testid="bar-content" style={{ padding: '12px 0' }}>Content under the bar</div>
      <ActionBar.Root open={n > 0} label="Sample actions" status={`${n} selected`} fallbackFocusRef={fallback}>
        <ActionBar.Action data-testid="bar-clear" onClick={() => setN(0)}>Clear</ActionBar.Action>
        <ActionBar.Action>Other</ActionBar.Action>
      </ActionBar.Root>
    </div>
  );
}

function SelectionCase() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" data-testid="selection-toggle" onClick={() => setOpen(!open)}>Toggle</button>
      <Inspector.Root open={open} onOpenChange={setOpen} className="sp-inspector">
        <Inspector.Trigger>Selection</Inspector.Trigger>
        <Inspector.Panel label="Selection" initialFocus={false}>
          <input data-testid="selection-input" defaultValue="Harbor rebuild" aria-label="Name" />
          <p data-testid="selection-text">Plain text that a person might select while the panel moves.</p>
          <div data-testid="selection-scroller" tabIndex={0} style={{ height: 80, overflow: 'auto' }}><Long n={20} /></div>
        </Inspector.Panel>
      </Inspector.Root>
    </div>
  );
}

function DeferCase() {
  const [typed, setTyped] = useState('');
  return (
    <Inspector.Root defaultOpen className="sp-inspector" data-testid="defer-inspector">
      <Inspector.Trigger>Deferred</Inspector.Trigger>
      <Inspector.Panel label="Deferred">
        <DeferControls typed={typed} setTyped={setTyped} />
      </Inspector.Panel>
    </Inspector.Root>
  );
}

function DeferControls({ typed, setTyped }: { typed: string; setTyped: (v: string) => void }) {
  const { closeAfter, pending } = useDefer();
  return (
    <>
      <input aria-label="Draft" data-testid="defer-input" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <button type="button" data-testid="defer-ok" onClick={() => closeAfter(new Promise((r) => setTimeout(r, 300)))}>Save and close</button>
      <button type="button" data-testid="defer-fail" onClick={() => closeAfter(new Promise((_, r) => setTimeout(r, 300)))}>Failing save</button>
      <output data-testid="defer-pending">{String(pending)}</output>
    </>
  );
}

import { useInspector as useDefer } from '@qbeka/react';

export function SpecialFixtures() {
  const name = new URLSearchParams(window.location.search).get('case');
  return (
    <main style={{ padding: 16, maxWidth: 560, margin: '0 auto', font: '14px system-ui' }}>
      <style>{`
        .sp-box { background: #eee; border-radius: 6px; }
        .sp-box[data-shape='small'] { width: 120px; }
        .sp-box[data-shape='small'] p { height: 40px; }
        .sp-box[data-shape='large'] { width: 300px; border-radius: 18px; }
        .sp-box[data-shape='large'] p { height: 200px; }
      `}</style>
      {name === 'transform' ? <><ShapeCase label="plain" wrapper={{}} /><ShapeCase label="scaled" wrapper={{ transform: 'scale(0.5)', transformOrigin: 'top left' }} /><ShapeCase label="rotated" wrapper={{ transform: 'rotate(10deg)' }} /></> : null}
      {name === 'scroll' ? <NestedScroll /> : null}
      {name === 'modal' ? <Controlled /> : null}
      {name === 'nested' ? <NestedPopups /> : null}
      {name === 'foundation' ? <Foundation /> : null}
      {name === 'actionbar' ? <ActionBarCase /> : null}
      {name === 'selection' ? <SelectionCase /> : null}
      {name === 'defer' ? <DeferCase /> : null}
    </main>
  );
}
