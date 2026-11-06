'use client';

import { Inspector } from '@qbeka/react/inspector';
import { useState } from 'react';

/** The explicitly client-side example. */
export function InteractiveInspector() {
  const [count, setCount] = useState(0);
  return (
    <Inspector.Root data-probe="box" onOpenChange={() => setCount((c) => c + 1)}>
      <Inspector.Trigger data-probe="trigger">Harbor rebuild</Inspector.Trigger>
      <Inspector.Panel label="Edit Harbor rebuild">
        <input data-probe="input" aria-label="Name" defaultValue="Harbor rebuild" />
        <output data-testid="count">{count}</output>
      </Inspector.Panel>
    </Inspector.Root>
  );
}
