# Qendrim UI

React components for interfaces that keep working when content, layout and intent change.

```bash
npm install @qbeka/react
```

```tsx
import { Inspector } from '@qbeka/react/inspector';
import '@qbeka/react/styles.css';

<Inspector.Root>
  <Inspector.Trigger>Harbor rebuild</Inspector.Trigger>
  <Inspector.Panel label="Edit Harbor rebuild">
    <input aria-label="Name" defaultValue="Harbor rebuild" />
  </Inspector.Panel>
</Inspector.Root>;
```

An import downloads no fonts, loads no icon catalog, installs no reset and needs no provider.

React 18.3 and 19 are tested. The source, the contract and the measurements are in the repository.
