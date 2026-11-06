import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dialog, Field, Input, Inspector, Popover, Select, Tabs, Timeline, Tooltip, ActionBar, Scope, Surface, useInspector, type SurfaceHandle } from '@qbeka/react';
import '@qbeka/react/styles.css';

function Saver() {
  const { closeAfter, pending } = useInspector();
  return <Button pending={pending} onClick={() => void closeAfter(new Promise((r) => setTimeout(r, 200)))}>Save and close</Button>;
}

function App() {
  const [open, setOpen] = useState(false);
  const handle = useRef<SurfaceHandle>(null);
  const [selected, setSelected] = useState(0);
  return (
    <main>
      <h1>Vite consumer</h1>
      <Inspector.Root open={open} onOpenChange={setOpen} data-probe="box">
        <Inspector.Trigger data-probe="trigger">Harbor rebuild</Inspector.Trigger>
        <Inspector.Panel label="Edit Harbor rebuild">
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input data-probe="input" defaultValue="Harbor rebuild" />
          </Field.Root>
          <Saver />
        </Inspector.Panel>
      </Inspector.Root>
      <Select aria-label="Split" items={[{ value: 'even', label: 'Even' }, { value: 'you', label: 'Yours' }]} defaultValue="even" />
      <Tabs.Root defaultValue="a"><Tabs.List aria-label="Tabs"><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List><Tabs.Panel value="a">Panel</Tabs.Panel></Tabs.Root>
      <Popover.Root><Popover.Trigger>Popover</Popover.Trigger><Popover.Content title="Title">Text</Popover.Content></Popover.Root>
      <Dialog.Root><Dialog.Trigger>Dialog</Dialog.Trigger><Dialog.Content title="Title"><Dialog.Close>Close</Dialog.Close></Dialog.Content></Dialog.Root>
      <Tooltip content="Hint"><Button>Tip</Button></Tooltip>
      <Timeline label="Time" min={0} max={10} defaultValue={2} />
      <Scope recipe="editorial"><Surface shape="a" handleRef={handle}><p>Scoped</p></Surface></Scope>
      <Button onClick={() => setSelected(selected + 1)}>Select</Button>
      <ActionBar.Root open={selected > 0} label="Actions" status={`${selected} selected`}><ActionBar.Action onClick={() => setSelected(0)}>Clear</ActionBar.Action></ActionBar.Root>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
