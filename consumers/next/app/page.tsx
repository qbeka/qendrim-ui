import { Button } from '@qbeka/react/button';
import { Field } from '@qbeka/react/field';
import { Input } from '@qbeka/react/input';
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
      <InteractiveInspector />
    </main>
  );
}
