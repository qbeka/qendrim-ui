export interface ApiRow {
  name: string;
  type: string;
  note: string;
}

export interface KeyRow {
  keys: string;
  action: string;
}

export interface ComponentDoc {
  slug: string;
  name: string;
  group: 'Signature' | 'Foundation';
  summary: string;
  importLine: string;
  css: string;
  upstream: string;
  example: string;
  api: ApiRow[];
  keyboard: KeyRow[];
  notes?: string[];
}

export const COMPONENTS: ComponentDoc[] = [
  {
    slug: 'surface',
    name: 'Surface',
    group: 'Signature',
    summary: 'One element that moves between CSS layouts. It keeps the same DOM node, so input state survives, and it retargets from where it is on screen.',
    importLine: "import { Surface } from '@qbeka/react/surface';",
    css: 'surface.css',
    upstream: 'None. Surface is the contribution of this library. It uses the browser for layout and React for the commit order, and it owns one spring per channel.',
    example: `function Example() {
  const [shape, setShape] = useState('small');
  return (
    <div>
      <Button onClick={() => setShape(shape === 'small' ? 'large' : 'small')}>
        Change shape
      </Button>
      <style>{\`
        .demo { background: var(--q-color-wash); border-radius: 8px; margin-top: 12px; }
        .demo[data-shape='small'] { width: 160px; }
        .demo[data-shape='large'] { width: 100%; border-radius: 20px; }
        .demo[data-shape='large'] p { min-height: 120px; }
      \`}</style>
      <Surface className="demo" shape={shape}>
        <p style={{ margin: 0, padding: 12 }}>Shape: {shape}</p>
      </Surface>
    </div>
  );
}`,
    api: [
      { name: 'shape', type: 'string', note: 'Required. The desired shape. CSS decides what it looks like, using [data-shape].' },
      { name: 'onSettle', type: '(shape: string) => void', note: 'Called when the latest request finishes. Never called for a superseded one.' },
      { name: 'handleRef', type: 'RefObject<SurfaceHandle>', note: 'Gives you token(), ifCurrent(token, action), invalidate() and snapshot().' },
      { name: 'onTrace', type: '(event: TraceEvent) => void', note: 'Engine events for diagnostics. Has no effect on behavior.' },
      { name: 'ref', type: 'Ref<HTMLDivElement>', note: 'The root element. Other props go to the root too.' },
      { name: '--q-surface-response', type: 'CSS number', note: 'Spring period in milliseconds. Read at each request.' },
      { name: '--q-surface-damping', type: 'CSS number', note: 'Damping ratio, up to 1.' },
    ],
    keyboard: [{ keys: 'None', action: 'Surface is not interactive. Inspector adds keyboard behavior.' }],
    notes: [
      'Use it for one panel that changes layout: a row that opens, a drawer that docks, a bar that grows.',
      'Do not use it for lists that reorder, or for moving something between two parents. It never reparents.',
      'Put padding on your content, not on the root. Put any max-height on [data-q-surface-content].',
    ],
  },
  {
    slug: 'inspector',
    name: 'Inspector',
    group: 'Signature',
    summary: 'A row that opens into an editor. It adds disclosure, the focus policy and deferred close to Surface. It is nonmodal unless you ask for modal.',
    importLine: "import { Inspector, useInspector } from '@qbeka/react/inspector';",
    css: 'inspector.css',
    upstream: 'The nonmodal form uses Surface. The modal form uses Base UI Dialog for focus trapping, the inert background, scroll lock and Escape, and Surface for geometry.',
    example: `function Example() {
  return (
    <Inspector.Root>
      <Inspector.Trigger>Field survey</Inspector.Trigger>
      <Inspector.Panel label="Edit Field survey">
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Input defaultValue="Field survey" />
        </Field.Root>
      </Inspector.Panel>
    </Inspector.Root>
  );
}`,
    api: [
      { name: 'Root open', type: 'boolean', note: 'Controlled state. Omit it and use defaultOpen for uncontrolled.' },
      { name: 'Root onOpenChange', type: '(open: boolean) => void', note: 'Fires for each request, including Escape.' },
      { name: 'Root modal', type: 'boolean', note: 'Use the dialog contract. Layout never turns this on for you.' },
      { name: 'Root sheet', type: 'boolean', note: 'Below 640 px a nonmodal panel docks to the bottom. It stays nonmodal.' },
      { name: 'Root fallbackFocusRef', type: 'RefObject<HTMLElement>', note: 'Where focus goes if the trigger is gone.' },
      { name: 'Root onSettle, onTrace', type: 'functions', note: 'As on Surface. onTrace also reports focus moves.' },
      { name: 'Panel label', type: 'string', note: 'Required. Names the panel for assistive technology.' },
      { name: 'Panel initialFocus', type: 'RefObject | false', note: 'The element to focus on open. False leaves focus alone. Defaults to the first field.' },
      { name: 'useInspector()', type: 'hook', note: 'Returns open, setOpen, pending and closeAfter(promise).' },
    ],
    keyboard: [
      { keys: 'Enter, Space', action: 'On the trigger: opens or closes.' },
      { keys: 'Escape', action: 'In the panel: closes and returns focus to the trigger.' },
      { keys: 'Tab', action: 'Nonmodal: moves on through the page. Modal: stays in the panel.' },
    ],
    notes: ['closeAfter closes when the work succeeds, unless the user reopened or typed in the meantime. It resolves to whether it closed.'],
  },
  {
    slug: 'timeline',
    name: 'Timeline',
    group: 'Signature',
    summary: 'A keyboard-operable transport with markers, for moving through a history or a period.',
    importLine: "import { Timeline } from '@qbeka/react/timeline';",
    css: 'timeline.css',
    upstream: 'Base UI Slider supplies the thumb, arrow keys, Home, End, Page Up, Page Down, pointer capture and the slider role. Timeline adds markers, previous and next jumps, and playback.',
    example: `function Example() {
  const [day, setDay] = useState(4);
  return (
    <Timeline
      label="Month"
      min={1}
      max={31}
      value={day}
      onValueChange={setDay}
      markers={[
        { value: 7, label: 'First payment' },
        { value: 19, label: 'Second payment' },
      ]}
      formatValue={(v) => 'Day ' + v}
    />
  );
}`,
    api: [
      { name: 'label', type: 'string', note: 'Required. Names the control.' },
      { name: 'min, max, step', type: 'number', note: 'Range. Step defaults to 1.' },
      { name: 'value, defaultValue', type: 'number', note: 'Controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(value: number) => void', note: 'Fires for dragging, keys, jumps and playback.' },
      { name: 'markers', type: '{ value, label }[]', note: 'Points on the track.' },
      { name: 'formatValue', type: '(value: number) => string', note: 'Used for the readout and for screen readers.' },
      { name: 'rate', type: 'number', note: 'Value units per second during playback. Defaults to a ten second run.' },
    ],
    keyboard: [
      { keys: 'Arrow keys', action: 'On the thumb: moves one step.' },
      { keys: 'Page Up, Page Down', action: 'On the thumb: moves a large step.' },
      { keys: 'Home, End', action: 'On the thumb: moves to the start or end.' },
      { keys: '[ and ]', action: 'Anywhere in the control: jumps to the previous or next marker.' },
    ],
    notes: ['With reduced motion, playback steps from marker to marker once a second.'],
  },
  {
    slug: 'actionbar',
    name: 'ActionBar',
    group: 'Signature',
    summary: 'Contextual actions that take no layout space, so selecting a row never moves the list.',
    importLine: "import { ActionBar } from '@qbeka/react/actionbar';",
    css: 'actionbar.css',
    upstream: 'Base UI Toolbar supplies the toolbar role and arrow key movement. ActionBar adds the zero-height anchor, the status announcement and Surface for the entrance.',
    example: `function Example() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ minHeight: 120 }}>
      <Button onClick={() => setCount(count + 1)}>Select one more</Button>
      <p>This text does not move when the bar appears.</p>
      <ActionBar.Root open={count > 0} label="Selection" status={count + ' selected'}>
        <ActionBar.Action onClick={() => setCount(0)}>Clear</ActionBar.Action>
      </ActionBar.Root>
    </div>
  );
}`,
    api: [
      { name: 'Root open', type: 'boolean', note: 'Required. Usually selection.length > 0.' },
      { name: 'Root label', type: 'string', note: 'Required. Names the toolbar.' },
      { name: 'Root status', type: 'string', note: 'Shown in the bar and announced politely.' },
      { name: 'Root fallbackFocusRef', type: 'RefObject<HTMLElement>', note: 'Where focus goes if the bar closes while it holds focus.' },
      { name: 'Action', type: 'button props', note: 'Each action. Disabled actions stay in place, so the bar keeps its width.' },
    ],
    keyboard: [
      { keys: 'Tab', action: 'Enters the toolbar once.' },
      { keys: 'Arrow Left, Arrow Right', action: 'Moves between actions.' },
    ],
    notes: ['The bar does not take focus when it appears, because the user is still selecting.'],
  },
  {
    slug: 'button',
    name: 'Button',
    group: 'Foundation',
    summary: 'A button with four variants and a pending state that keeps its label.',
    importLine: "import { Button } from '@qbeka/react/button';",
    css: 'button.css',
    upstream: 'Base UI Button supplies disabled handling and rendering as another element. This adds styles and the pending state.',
    example: `function Example() {
  const [pending, setPending] = useState(false);
  const save = () => {
    setPending(true);
    setTimeout(() => setPending(false), 1200);
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="primary" pending={pending} onClick={save}>Save</Button>
      <Button>Cancel</Button>
      <Button variant="ghost">More</Button>
      <Button variant="danger">Delete</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}`,
    api: [
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger'", note: "Defaults to 'secondary'." },
      { name: 'pending', type: 'boolean', note: 'Ignores clicks, shows an indicator and stays focusable.' },
      { name: 'disabled', type: 'boolean', note: 'Native disabled. Removes it from the tab order.' },
      { name: 'render', type: 'element or function', note: 'From Base UI. Renders as another element, such as a link.' },
    ],
    keyboard: [{ keys: 'Enter, Space', action: 'Activates.' }],
  },
  {
    slug: 'input',
    name: 'Input',
    group: 'Foundation',
    summary: 'A native input that works with Field.',
    importLine: "import { Input } from '@qbeka/react/input';",
    css: 'input.css',
    upstream: 'Base UI Input connects the element to Field. It renders a native input, so the browser supplies everything else.',
    example: `function Example() {
  return <Input aria-label="Search" placeholder="Search projects" />;
}`,
    api: [
      { name: 'All input props', type: 'native', note: 'Controlled or uncontrolled, like a native input.' },
      { name: 'render', type: 'element or function', note: 'Pass a textarea to get a multi-line field.' },
    ],
    keyboard: [{ keys: 'Native', action: 'The browser handles typing, selection and undo.' }],
  },
  {
    slug: 'field',
    name: 'Field',
    group: 'Foundation',
    summary: 'A label, a control, a description and an error, connected for assistive technology.',
    importLine: "import { Field } from '@qbeka/react/field';",
    css: 'field.css',
    upstream: 'Base UI Field supplies the ids, the label and description wiring, and validity state. This adds styles.',
    example: `function Example() {
  const [value, setValue] = useState('12a');
  const invalid = !/^\\d+$/.test(value);
  return (
    <Field.Root invalid={invalid}>
      <Field.Label>Budget</Field.Label>
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      {invalid
        ? <Field.Error match>Use digits only.</Field.Error>
        : <Field.Description>In whole dollars.</Field.Description>}
    </Field.Root>
  );
}`,
    api: [
      { name: 'Root invalid', type: 'boolean', note: 'Marks the control invalid.' },
      { name: 'Root disabled', type: 'boolean', note: 'Disables the control.' },
      { name: 'Root name', type: 'string', note: 'For form submission.' },
      { name: 'Error match', type: 'boolean or validity key', note: 'When to show the message.' },
    ],
    keyboard: [{ keys: 'Native', action: 'Clicking the label focuses the control.' }],
  },
  {
    slug: 'select',
    name: 'Select',
    group: 'Foundation',
    summary: 'A list of options in a popup.',
    importLine: "import { Select } from '@qbeka/react/select';",
    css: 'select.css and popup.css',
    upstream: 'Base UI Select supplies the listbox pattern, typeahead, keyboard movement, positioning and the portal. This adds styles and an items prop.',
    example: `function Example() {
  const [value, setValue] = useState('even');
  return (
    <Select
      aria-label="Split"
      value={value}
      onValueChange={setValue}
      items={[
        { value: 'even', label: 'Split evenly' },
        { value: 'you', label: 'All yours' },
        { value: 'sam', label: 'All Sam', disabled: true },
      ]}
    />
  );
}`,
    api: [
      { name: 'items', type: '{ value, label, disabled? }[]', note: 'Required.' },
      { name: 'value, defaultValue', type: 'string', note: 'Controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(value) => void', note: 'Fires on selection.' },
      { name: 'placeholder', type: 'string', note: 'Shown when nothing is selected.' },
      { name: 'aria-label', type: 'string', note: 'Required unless a Field label names it.' },
      { name: 'container', type: 'HTMLElement', note: 'The portal target. Defaults to <body>.' },
      { name: 'disabled', type: 'boolean', note: 'Disables the trigger.' },
    ],
    keyboard: [
      { keys: 'Enter, Space, Arrow Up, Arrow Down', action: 'On the trigger: opens.' },
      { keys: 'Arrow keys, Home, End', action: 'In the list: moves the highlight.' },
      { keys: 'Letters', action: 'Typeahead.' },
      { keys: 'Enter', action: 'Selects and closes.' },
      { keys: 'Escape', action: 'Closes and keeps the value. It does not close a parent Inspector.' },
    ],
  },
  {
    slug: 'tabs',
    name: 'Tabs',
    group: 'Foundation',
    summary: 'Sections of one view, one at a time.',
    importLine: "import { Tabs } from '@qbeka/react/tabs';",
    css: 'tabs.css',
    upstream: 'Base UI Tabs supplies the tablist pattern, roving focus and the indicator measurements. This adds styles.',
    example: `function Example() {
  return (
    <Tabs.Root defaultValue="edit">
      <Tabs.List aria-label="Receipt sections">
        <Tabs.Tab value="edit">Edit</Tabs.Tab>
        <Tabs.Tab value="history">History</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="edit">Edit the receipt here.</Tabs.Panel>
      <Tabs.Panel value="history">Nothing changed yet.</Tabs.Panel>
    </Tabs.Root>
  );
}`,
    api: [
      { name: 'Root value, defaultValue', type: 'string', note: 'Controlled or uncontrolled.' },
      { name: 'Root onValueChange', type: '(value) => void', note: 'Fires on change.' },
      { name: 'List aria-label', type: 'string', note: 'Names the tab list.' },
      { name: 'Tab value', type: 'string', note: 'Required.' },
      { name: 'Tab disabled', type: 'boolean', note: 'Skipped by arrow keys.' },
      { name: 'Panel value', type: 'string', note: 'Required.' },
    ],
    keyboard: [
      { keys: 'Arrow Left, Arrow Right', action: 'Moves between tabs.' },
      { keys: 'Home, End', action: 'Moves to the first or last tab.' },
      { keys: 'Tab', action: 'Moves into the panel.' },
    ],
  },
  {
    slug: 'popover',
    name: 'Popover',
    group: 'Foundation',
    summary: 'Extra content next to a trigger.',
    importLine: "import { Popover } from '@qbeka/react/popover';",
    css: 'popup.css',
    upstream: 'Base UI Popover supplies positioning, collision handling, focus handling, dismissal and the portal. This adds styles and joins the parts into one Content.',
    example: `function Example() {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button>About this split</Button>} />
      <Popover.Content title="Split evenly">
        Each person pays half.
      </Popover.Content>
    </Popover.Root>
  );
}`,
    api: [
      { name: 'Root open, defaultOpen', type: 'boolean', note: 'Controlled or uncontrolled.' },
      { name: 'Root onOpenChange', type: '(open) => void', note: 'Fires on change.' },
      { name: 'Trigger render', type: 'element', note: 'Use your own button.' },
      { name: 'Content title', type: 'ReactNode', note: 'The visible heading, which also names the popup.' },
      { name: 'Content side, align', type: 'string', note: 'Preferred placement.' },
      { name: 'Content container', type: 'HTMLElement', note: 'The portal target. Defaults to <body>.' },
    ],
    keyboard: [
      { keys: 'Enter, Space', action: 'On the trigger: opens.' },
      { keys: 'Escape', action: 'Closes and returns focus to the trigger.' },
    ],
  },
  {
    slug: 'dialog',
    name: 'Dialog',
    group: 'Foundation',
    summary: 'A modal window for a focused decision.',
    importLine: "import { Dialog } from '@qbeka/react/dialog';",
    css: 'dialog.css',
    upstream: 'Base UI Dialog supplies the whole dialog contract: the role, focus trap, inert background, scroll lock, Escape and focus return. This adds styles and joins the parts into one Content. It does not rebuild any of that.',
    example: `function Example() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="danger">Delete project</Button>} />
      <Dialog.Content title="Delete this project?" description="You can undo this for ten seconds.">
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Dialog.Close render={<Button variant="danger">Delete</Button>} />
          <Dialog.Close render={<Button>Cancel</Button>} />
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}`,
    api: [
      { name: 'Root open, defaultOpen', type: 'boolean', note: 'Controlled or uncontrolled.' },
      { name: 'Root onOpenChange', type: '(open) => void', note: 'Fires on change.' },
      { name: 'Content title', type: 'ReactNode', note: 'Required. The visible heading, which also names the dialog.' },
      { name: 'Content description', type: 'ReactNode', note: 'Optional.' },
      { name: 'Content initialFocus, finalFocus', type: 'from Base UI', note: 'Override where focus goes.' },
      { name: 'Content container', type: 'HTMLElement', note: 'The portal target. Defaults to <body>.' },
    ],
    keyboard: [
      { keys: 'Tab, Shift+Tab', action: 'Cycles inside the dialog.' },
      { keys: 'Escape', action: 'Closes and returns focus to the trigger.' },
    ],
  },
  {
    slug: 'tooltip',
    name: 'Tooltip',
    group: 'Foundation',
    summary: 'A short hint on hover or focus.',
    importLine: "import { Tooltip } from '@qbeka/react/tooltip';",
    css: 'popup.css',
    upstream: 'Base UI Tooltip supplies delays, positioning, hover and focus handling, and the portal. This adds styles and one short API.',
    example: `function Example() {
  return (
    <Tooltip content="Reverts your last change">
      <Button>Undo</Button>
    </Tooltip>
  );
}`,
    api: [
      { name: 'content', type: 'ReactNode', note: 'Required. A hint, never the only name of a control.' },
      { name: 'children', type: 'one element', note: 'Required. It must be able to hold focus.' },
      { name: 'side', type: 'string', note: 'Preferred side.' },
      { name: 'delay', type: 'number', note: 'Milliseconds before it opens on hover. Defaults to 400.' },
    ],
    keyboard: [
      { keys: 'Tab', action: 'Focusing the trigger shows the hint.' },
      { keys: 'Escape', action: 'Hides the hint.' },
    ],
    notes: ['Touch screens have no hover, so do not put anything essential in a tooltip.'],
  },
];
