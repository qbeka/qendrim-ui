import { ActionBar, Button, Dialog, Inspector, ModalInspector, Popover, Select, Surface, Tabs, Timeline, Tooltip, Input, Field } from '@qbeka/react';
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
      <ModalInspector.Root open={open} onOpenChange={setOpen} fallbackFocusRef={triggerHost}>
        {removed ? null : <ModalInspector.Trigger data-testid="modal-trigger">Open modal</ModalInspector.Trigger>}
        <ModalInspector.Panel label="Modal review">
          <Field.Root><Field.Label>Amount</Field.Label><Input data-testid="modal-input" defaultValue="42.18" /></Field.Root>
          <ModalInspector.Close data-testid="modal-close">Close</ModalInspector.Close>
          <button type="button" data-testid="modal-remove-trigger" onClick={() => setRemoved(true)}>Remove trigger</button>
        </ModalInspector.Panel>
      </ModalInspector.Root>
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
      {name ? VARIANTS[name] : null}
    </main>
  );
}

const VARIANT_CSS = `
.v { background: #e4e4e0; }
.v-right { position: absolute; right: 0; top: 60px; height: 80px; }
.v-right[data-shape='a'] { width: 100px; } .v-right[data-shape='b'] { width: 400px; }
.v-center { margin-inline: auto; height: 80px; }
.v-center[data-shape='a'] { width: 100px; } .v-center[data-shape='b'] { width: 400px; }
.v-bottom { position: fixed; bottom: 0; left: 20px; width: 300px; }
.v-bottom[data-shape='a'] { height: 60px; } .v-bottom[data-shape='b'] { height: 320px; }
.v-rtl[data-shape='a'] { width: 100px; height: 80px; } .v-rtl[data-shape='b'] { width: 400px; height: 80px; }
.v-box[data-shape='a'] { width: 120px; height: 60px; border-radius: 4px; }
.v-box[data-shape='b'] { width: 300px; height: 240px; border-radius: 30px; }
.v-all { transition: all 200ms; }
.v-translated { position: absolute; left: 50%; top: 60px; translate: -50% 0; height: 80px; }
.v-translated[data-shape='a'] { width: 100px; } .v-translated[data-shape='b'] { width: 400px; }
.v-mixed { border-radius: 12px 12px 0 0; }
.v-mixed[data-shape='a'] { width: 120px; height: 60px; } .v-mixed[data-shape='b'] { width: 300px; height: 240px; border-radius: 0; }
.v-pad { padding: 40px; }
.v-min { min-height: 300px; }
.v-content-box { width: 300px; padding: 20px; box-sizing: content-box; }
.v-scroll[data-shape='a'] { height: 150px; overflow: auto; } .v-scroll[data-shape='b'] { height: 260px; overflow: auto; }
`;

function Variant({ className, wrapper, style, children }: { className: string; wrapper?: CSSProperties; style?: CSSProperties; children?: React.ReactNode }) {
  const [shape, setShape] = useState('a');
  return (
    <div style={{ position: 'relative', ...wrapper }}>
      <style>{VARIANT_CSS}</style>
      <button type="button" data-testid="toggle" onClick={() => setShape((s) => (s === 'a' ? 'b' : 'a'))}>Toggle</button>
      <Surface data-testid="surface" className={`v ${className}`} shape={shape} style={style}>{children ?? <div data-testid="inner" style={{ height: 40 }}>Text that wraps at its own width</div>}</Surface>
    </div>
  );
}

function Grow({ className }: { className: string }) {
  const [tall, setTall] = useState(false);
  return (
    <div>
      <style>{VARIANT_CSS}</style>
      <button type="button" data-testid="grow" onClick={() => setTall((t) => !t)}>Grow</button>
      <Surface data-testid="surface" className={`v ${className}`} shape="a"><div style={{ height: tall ? 180 : 60 }}>Content</div></Surface>
    </div>
  );
}

function FocusHoles() {
  const [triggerGone, setTriggerGone] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [fieldGone, setFieldGone] = useState(false);
  const fallback = useRef<HTMLButtonElement>(null);
  const initial = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button type="button" ref={fallback} data-testid="f-fallback">Fallback</button>
      <button type="button" data-testid="f-remove-trigger" onClick={() => setTriggerGone(true)}>Remove trigger</button>
      <button type="button" data-testid="f-disable" onClick={() => setDisabled(true)}>Disable</button>
      <button type="button" data-testid="f-remove-field" onClick={() => setFieldGone(true)}>Remove field</button>
      <Inspector.Root fallbackFocusRef={fallback} className="sp-inspector" data-testid="f-root">
        {triggerGone ? null : <Inspector.Trigger data-testid="f-trigger" disabled={disabled}>Row</Inspector.Trigger>}
        <Inspector.Panel label="Holes" initialFocus={initial}>
          <input aria-label="First" data-testid="f-first" />
          <input aria-label="Preferred" data-testid="f-preferred" ref={initial} />
          {fieldGone ? null : <input aria-label="Doomed" data-testid="f-doomed" />}
        </Inspector.Panel>
      </Inspector.Root>
    </div>
  );
}

function ModalScroll() {
  const [open, setOpen] = useState(false);
  return (
    <ModalInspector.Root open={open} onOpenChange={setOpen}>
      <ModalInspector.Trigger data-testid="ms-trigger">Open</ModalInspector.Trigger>
      <ModalInspector.Panel label="Long modal">
        <input aria-label="Field" data-testid="ms-input" />
        <input aria-label="Second field" data-testid="ms-second" />
        <Long n={80} />
        <ModalInspector.Close data-testid="ms-close">Close</ModalInspector.Close>
      </ModalInspector.Panel>
    </ModalInspector.Root>
  );
}

function TimelineEdges() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  return (
    <div>
      <Timeline label="Stepped" min={0} max={95} step={10} value={a} onValueChange={setA} rate={400} />
      <output data-testid="stepped">{a}</output>
      <Timeline label="Seek" min={0} max={1000} value={b} onValueChange={setB} rate={100} markers={[{ value: 600, label: 'Six hundred' }]} />
      <output data-testid="seek">{b}</output>
    </div>
  );
}

export const VARIANTS: Record<string, React.ReactNode> = {
  right: <Variant className="v-right" wrapper={{ height: 200 }} />,
  center: <Variant className="v-center" />,
  translated: <Variant className="v-translated" wrapper={{ height: 200 }} />,
  bottom: <Variant className="v-bottom" />,
  rtl: <div dir="rtl"><Variant className="v-rtl" /></div>,
  scaled: <Variant className="v-box" wrapper={{ transform: 'scale(0.5)', transformOrigin: 'top left' }} />,
  zoomed: <Variant className="v-box" wrapper={{ zoom: 2 } as CSSProperties} />,
  mirrored: <Variant className="v-box" wrapper={{ transform: 'scaleX(-1)' }} />,
  box: <Variant className="v-box" />,
  all: <Variant className="v-box v-all" />,
  mixed: <Variant className="v-mixed" />,
  scroll: <Variant className="v-scroll"><Long n={40} /></Variant>,
  inline: <Variant className="v-box" style={{ overflow: 'auto', outline: '1px solid red', boxShadow: 'none' }} />,
  inlinewidth: <Variant className="v-box-free" style={{ width: 320, borderRadius: 20, overflow: 'auto' }}><div style={{ height: 60 }}>Inline</div></Variant>,
  pad: <Grow className="v-pad" />,
  min: <Grow className="v-min" />,
  contentbox: <Grow className="v-content-box" />,
  holes: <FocusHoles />,
  modalscroll: <ModalScroll />,
  timeline: <TimelineEdges />,
};
