/** What each gallery specimen shows as its usage example. gallery/usage.test.ts parses them. */
export const USAGE = {
  surface: `import { Surface } from '@qbeka/react/surface';
import '@qbeka/react/styles.css';

// .card[data-shape='small'] { width: 120px; }
// .card[data-shape='large'] { width: 100%; height: 160px; }
function Card() {
  const [shape, setShape] = useState('small');
  const next = shape === 'small' ? 'large' : 'small';
  return (
    <Surface
      className="card"
      shape={shape}
      onClick={() => setShape(next)}
    >
      Press me twice, quickly
    </Surface>
  );
}`,
  inspector: `import { Inspector, useInspector } from '@qbeka/react/inspector';
import '@qbeka/react/styles.css';

function SaveAndClose({ save }) {
  const { closeAfter } = useInspector();
  return (
    <button onClick={() => closeAfter(save())}>
      Save and close
    </button>
  );
}

<Inspector.Root>
  <Inspector.Trigger>Pier survey</Inspector.Trigger>
  <Inspector.Panel label="Edit Pier survey">
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
  markers={[{ value: 7, label: 'Survey paid' }]}
  formatValue={(value) => 'Day ' + value}
/>`,
  actionbar: `import { ActionBar } from '@qbeka/react/actionbar';
import '@qbeka/react/styles.css';

<ActionBar.Root
  open={selected.length > 0}
  label="Receipts"
  status={selected.length + ' selected'}
>
  <ActionBar.Action onClick={approve}>Approve</ActionBar.Action>
  <ActionBar.Action onClick={clear}>Clear</ActionBar.Action>
</ActionBar.Root>`,
} as const;
