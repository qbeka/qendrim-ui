import { Button } from '@qbeka/react/button';
import { Dialog } from '@qbeka/react/dialog';
import { Field } from '@qbeka/react/field';
import { Input } from '@qbeka/react/input';
import { Inspector } from '@qbeka/react/inspector';
import { Popover } from '@qbeka/react/popover';
import { Tabs } from '@qbeka/react/tabs';
import { InteractiveInspector } from './interactive';

/**
 * A server component. The SSR-safe example: it renders the library's components to HTML
 * with no client code of its own. The interactive example is in interactive.tsx.
 */
export default function Page() {
  return (
    <main>
      <h1 data-testid="server-heading">Next consumer</h1>
      <Button data-testid="server-button">Rendered on the server</Button>
      <Field.Root>
        <Field.Label>Server field</Field.Label>
        <Input data-testid="server-input" defaultValue="from the server" />
      </Field.Root>
      <Tabs.Root defaultValue="a"><Tabs.List aria-label="Sections"><Tabs.Tab value="a">Server tab</Tabs.Tab></Tabs.List><Tabs.Panel value="a">Tab panel</Tabs.Panel></Tabs.Root>
      <Popover.Root><Popover.Trigger>Popover</Popover.Trigger><Popover.Content title="Title">Text</Popover.Content></Popover.Root>
      <Dialog.Root><Dialog.Trigger>Dialog</Dialog.Trigger><Dialog.Content title="Title">Text</Dialog.Content></Dialog.Root>
      <Inspector.Root><Inspector.Trigger>Server row</Inspector.Trigger><Inspector.Panel label="Server panel">Panel body</Inspector.Panel></Inspector.Root>
      <InteractiveInspector />
    </main>
  );
}
