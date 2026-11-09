import { Button } from '@qbeka/react/button';
import { Dialog } from '@qbeka/react/dialog';
import { Field } from '@qbeka/react/field';
import { Input } from '@qbeka/react/input';
import { Popover } from '@qbeka/react/popover';
import { Select } from '@qbeka/react/select';
import { Tabs } from '@qbeka/react/tabs';
import { Tooltip } from '@qbeka/react/tooltip';
import { useState, type ReactNode } from 'react';

function SelectPreview() {
  const [value, setValue] = useState('even');
  return (
    <Select aria-label="Split" value={value} onValueChange={(next) => next && setValue(next)} items={[{ value: 'even', label: 'Split evenly' }, { value: 'you', label: 'All yours' }, { value: 'sam', label: 'All Sam', disabled: true }]} />
  );
}

function FieldPreview() {
  const [value, setValue] = useState('1200');
  const invalid = !/^\d+$/.test(value);
  return (
    <Field.Root invalid={invalid}>
      <Field.Label>Budget</Field.Label>
      <Input value={value} onChange={(event) => setValue(event.target.value)} inputMode="numeric" />
      {invalid ? <Field.Error match>Use digits only.</Field.Error> : <Field.Description>In whole dollars.</Field.Description>}
    </Field.Root>
  );
}

/** A small working piece for each foundation component, shown on the components page. */
export const PREVIEWS: Record<string, ReactNode> = {
  button: (
    <div className="d-preview-row">
      <Button variant="primary">Save</Button>
      <Button>Cancel</Button>
      <Button variant="ghost">More</Button>
    </div>
  ),
  input: <Input aria-label="Search projects" placeholder="Search projects" />,
  field: <FieldPreview />,
  select: <SelectPreview />,
  tabs: (
    <Tabs.Root defaultValue="edit">
      <Tabs.List aria-label="Receipt sections">
        <Tabs.Tab value="edit">Edit</Tabs.Tab>
        <Tabs.Tab value="history">History</Tabs.Tab>
        <Tabs.Tab value="notes">Notes</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="edit">Edit the receipt here.</Tabs.Panel>
      <Tabs.Panel value="history">Nothing changed yet.</Tabs.Panel>
      <Tabs.Panel value="notes">No notes yet.</Tabs.Panel>
    </Tabs.Root>
  ),
  popover: (
    <Popover.Root>
      <Popover.Trigger render={<Button>About this split</Button>} />
      <Popover.Content title="Split evenly">Each person pays half.</Popover.Content>
    </Popover.Root>
  ),
  dialog: (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="danger">Delete project</Button>} />
      <Dialog.Content title="Delete this project?" description="Nothing is deleted here, because this is a preview.">
        <div className="d-preview-row d-preview-end">
          <Dialog.Close render={<Button variant="danger">Delete</Button>} />
          <Dialog.Close render={<Button>Cancel</Button>} />
        </div>
      </Dialog.Content>
    </Dialog.Root>
  ),
  tooltip: (
    <Tooltip content="Reverts your last change"><Button>Undo</Button></Tooltip>
  ),
};
