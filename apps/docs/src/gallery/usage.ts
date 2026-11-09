/** What each specimen shows as its usage example. gallery/usage.test.ts parses them. */
export const USAGE = {
  surface: `import { Surface } from '@qbeka/react/surface';
import '@qbeka/react/styles.css';

// .timer[data-shape='pill'] { width: 122px; height: 36px; }
// .timer[data-shape='card'] { width: 264px; height: 220px; }
function Timer() {
  const [shape, setShape] = useState('pill');
  const next = shape === 'pill' ? 'card' : 'pill';
  return (
    <Surface className="timer" shape={shape}>
      <button onClick={() => setShape(next)}>25:00</button>
    </Surface>
  );
}`,
  inspector: `import { Inspector, useInspector } from '@qbeka/react/inspector';
import '@qbeka/react/styles.css';

function SaveAndClose({ save }) {
  const { closeAfter } = useInspector();
  return <button onClick={() => closeAfter(save())}>Save and close</button>;
}

<Inspector.Root>
  <Inspector.Trigger>Mira Okafor</Inspector.Trigger>
  <Inspector.Panel label="Edit Mira Okafor">
    <input aria-label="Note" />
    <SaveAndClose save={saveNote} />
  </Inspector.Panel>
</Inspector.Root>`,
  timeline: `import { Timeline } from '@qbeka/react/timeline';
import '@qbeka/react/styles.css';

<Timeline
  label="Budget history"
  min={1}
  max={31}
  value={day}
  onValueChange={setDay}
  markers={[{ value: 11, label: 'Survey paid' }]}
  formatValue={(value) => 'Day ' + value}
/>`,
  actionbar: `import { ActionBar } from '@qbeka/react/actionbar';
import '@qbeka/react/styles.css';

<ActionBar.Root
  open={selected.length > 0}
  label="Receipt actions"
  status={selected.length + ' selected'}
>
  <ActionBar.Action onClick={approve}>Approve</ActionBar.Action>
  <ActionBar.Action onClick={clear}>Clear</ActionBar.Action>
</ActionBar.Root>`,
} as const;

/** The first thing to paste after installing. The README shows the same example. */
export const FIRST_EXAMPLE = `import { Inspector } from '@qbeka/react/inspector';
import '@qbeka/react/styles.css';

export function ProjectRow() {
  return (
    <Inspector.Root>
      <Inspector.Trigger>Harbor rebuild</Inspector.Trigger>
      <Inspector.Panel label="Edit Harbor rebuild">
        <input aria-label="Name" defaultValue="Harbor rebuild" />
      </Inspector.Panel>
    </Inspector.Root>
  );
}`;

export const INSTALL = 'npm install https://github.com/qbeka/qendrim-ui/releases/download/v0.1.0/qbeka-react-0.1.0.tgz';
