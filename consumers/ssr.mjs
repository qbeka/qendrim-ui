// Renders components in plain Node, with no DOM globals, from the installed tarball.
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Button, Field, Input, Inspector, Select, Surface, Tabs, Timeline } from '@qbeka/react';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Expected no DOM.');

const errors = [];
const nativeError = console.error;
console.error = (...args) => errors.push(args.join(' '));

const html = renderToString(
  h('main', null,
    h(Button, null, 'Save'),
    h(Field.Root, null, h(Field.Label, null, 'Name'), h(Input, { defaultValue: 'x' })),
    h(Select, { 'aria-label': 'S', items: [{ value: 'a', label: 'A' }], defaultValue: 'a' }),
    h(Tabs.Root, { defaultValue: 'a' }, h(Tabs.List, { 'aria-label': 'T' }, h(Tabs.Tab, { value: 'a' }, 'A')), h(Tabs.Panel, { value: 'a' }, 'P')),
    h(Timeline, { label: 'Time', min: 0, max: 10, defaultValue: 2 }),
    h(Surface, { shape: 'a' }, 'S'),
    h(Inspector.Root, null, h(Inspector.Trigger, null, 'Row'), h(Inspector.Panel, { label: 'Panel' }, 'Body')),
  ),
);

console.error = nativeError;
for (const expected of ['data-q-surface', 'data-shape="closed"', 'aria-expanded="false"', 'q-button']) {
  if (!html.includes(expected)) throw new Error(`Server HTML is missing ${expected}`);
}
if (errors.length > 0) throw new Error(`Server render logged: ${errors.join(' | ')}`);
console.log(JSON.stringify({ ok: true, bytes: html.length }));
