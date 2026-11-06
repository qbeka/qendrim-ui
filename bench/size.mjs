// Per-import cost, from the installed tarball, with esbuild. React is external so its cost
// can be stated once, on its own. Everything else a consumer would download is included.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { ROOT } from './lib.mjs';

const CONSUMER = join(ROOT, 'consumers/.work/vite-react-19');
const REACT_EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

const gz = (b) => gzipSync(b, { level: 9 }).length;
const br = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** Each pair renders the same thing. The left side uses this library, the right the primitive. */
const ENTRIES = {
  button: {
    q: `import { Button } from '@qbeka/react/button'; export const X = () => <Button variant="primary" pending={false}>Save</Button>;`,
    base: `import { Button } from '@base-ui/react/button'; export const X = () => <Button className="q-button">Save</Button>;`,
  },
  input: {
    q: `import { Input } from '@qbeka/react/input'; export const X = () => <Input aria-label="Name" />;`,
    base: `import { Input } from '@base-ui/react/input'; export const X = () => <Input aria-label="Name" className="q-input" />;`,
  },
  field: {
    q: `import { Field } from '@qbeka/react/field'; export const X = () => <Field.Root><Field.Label>Name</Field.Label><Field.Description>Hint</Field.Description><Field.Error match>Bad</Field.Error></Field.Root>;`,
    base: `import { Field } from '@base-ui/react/field'; export const X = () => <Field.Root className="q-field"><Field.Label className="q-field-label">Name</Field.Label><Field.Description className="q-field-description">Hint</Field.Description><Field.Error className="q-field-error" match>Bad</Field.Error></Field.Root>;`,
  },
  select: {
    q: `import { Select } from '@qbeka/react/select'; export const X = () => <Select aria-label="S" items={[{value:'a',label:'A'}]} />;`,
    base: `import { Select } from '@base-ui/react/select'; const items=[{value:'a',label:'A'}]; export const X = () => <Select.Root items={items}><Select.Trigger aria-label="S"><Select.Value placeholder="Choose" /><Select.Icon /></Select.Trigger><Select.Portal><Select.Positioner><Select.Popup><Select.List>{items.map((i) => <Select.Item key={i.value} value={i.value}><Select.ItemText>{i.label}</Select.ItemText><Select.ItemIndicator /></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal></Select.Root>;`,
  },
  tabs: {
    q: `import { Tabs } from '@qbeka/react/tabs'; export const X = () => <Tabs.Root defaultValue="a"><Tabs.List aria-label="T"><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List><Tabs.Panel value="a">P</Tabs.Panel></Tabs.Root>;`,
    base: `import { Tabs } from '@base-ui/react/tabs'; export const X = () => <Tabs.Root defaultValue="a"><Tabs.List aria-label="T"><Tabs.Tab value="a">A</Tabs.Tab><Tabs.Indicator /></Tabs.List><Tabs.Panel value="a">P</Tabs.Panel></Tabs.Root>;`,
  },
  popover: {
    q: `import { Popover } from '@qbeka/react/popover'; export const X = () => <Popover.Root><Popover.Trigger>O</Popover.Trigger><Popover.Content title="T">B</Popover.Content></Popover.Root>;`,
    base: `import { Popover } from '@base-ui/react/popover'; export const X = () => <Popover.Root><Popover.Trigger>O</Popover.Trigger><Popover.Portal><Popover.Positioner><Popover.Popup><Popover.Title>T</Popover.Title>B</Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;`,
  },
  dialog: {
    q: `import { Dialog } from '@qbeka/react/dialog'; export const X = () => <Dialog.Root><Dialog.Trigger>O</Dialog.Trigger><Dialog.Content title="T">B</Dialog.Content></Dialog.Root>;`,
    base: `import { Dialog } from '@base-ui/react/dialog'; export const X = () => <Dialog.Root><Dialog.Trigger>O</Dialog.Trigger><Dialog.Portal><Dialog.Backdrop /><Dialog.Popup><Dialog.Title>T</Dialog.Title>B</Dialog.Popup></Dialog.Portal></Dialog.Root>;`,
  },
  tooltip: {
    q: `import { Tooltip } from '@qbeka/react/tooltip'; export const X = () => <Tooltip content="H"><button>B</button></Tooltip>;`,
    base: `import { Tooltip } from '@base-ui/react/tooltip'; export const X = () => <Tooltip.Root><Tooltip.Trigger render={<button>B</button>} /><Tooltip.Portal><Tooltip.Positioner><Tooltip.Popup>H</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal></Tooltip.Root>;`,
  },
};

const SIGNATURE = {
  surface: `import { Surface } from '@qbeka/react/surface'; export const X = () => <Surface shape="a">B</Surface>;`,
  inspector: `import { Inspector } from '@qbeka/react/inspector'; export const X = () => <Inspector.Root><Inspector.Trigger>R</Inspector.Trigger><Inspector.Panel label="P">B</Inspector.Panel></Inspector.Root>;`,
  timeline: `import { Timeline } from '@qbeka/react/timeline'; export const X = () => <Timeline label="T" min={0} max={1} />;`,
  actionbar: `import { ActionBar } from '@qbeka/react/actionbar'; export const X = () => <ActionBar.Root open label="A"><ActionBar.Action>G</ActionBar.Action></ActionBar.Root>;`,
  'barrel, Button only': `import { Button } from '@qbeka/react'; export const X = () => <Button>Save</Button>;`,
  'barrel, everything': `export * from '@qbeka/react';`,
  'motion, layout prop': `import { motion } from 'motion/react'; export const X = () => <motion.div layout>B</motion.div>;`,
  'motion, height animation': `import { motion } from 'motion/react'; export const X = () => <motion.div animate={{ height: 'auto' }}>B</motion.div>;`,
};

const CSS = {
  tokens: ['tokens.css'],
  surface: ['surface.css'],
  inspector: ['surface.css', 'inspector.css'],
  button: ['button.css'],
  input: ['input.css'],
  field: ['field.css'],
  select: ['select.css', 'popup.css'],
  tabs: ['tabs.css'],
  popover: ['popup.css'],
  dialog: ['dialog.css'],
  tooltip: ['popup.css'],
  timeline: ['timeline.css'],
  actionbar: ['surface.css', 'actionbar.css'],
  recipes: ['recipes.css'],
};

async function bundle(name, source, external = REACT_EXTERNAL) {
  const dir = join(CONSUMER, '.size');
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'entry.jsx');
  writeFileSync(entry, source);
  const result = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'esm', jsx: 'automatic', write: false, external, metafile: true, logLevel: 'silent', platform: 'browser', target: 'es2022', conditions: ['import', 'browser'], absWorkingDir: CONSUMER, treeShaking: true, define: { 'process.env.NODE_ENV': '"production"' } });
  const bytes = result.outputFiles[0].contents;
  const byPackage = {};
  const inputs = result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].inputs;
  for (const [path, info] of Object.entries(inputs)) {
    const match = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\/(?!.*node_modules)/);
    const key = match ? match[1] : 'entry';
    byPackage[key] = (byPackage[key] ?? 0) + info.bytesInOutput;
  }
  return { name, minified: bytes.length, gzip: gz(bytes), brotli: br(bytes), byPackage };
}

export async function measureSizes() {
  const versions = { esbuild: JSON.parse(readFileSync(join(ROOT, 'node_modules/esbuild/package.json'), 'utf8')).version };
  const foundation = [];
  for (const [name, pair] of Object.entries(ENTRIES)) {
    const q = await bundle(name, pair.q);
    const base = await bundle(name, pair.base);
    foundation.push({ name, q, base, incrementalGzip: q.gzip - base.gzip });
  }
  const signature = [];
  for (const [name, source] of Object.entries(SIGNATURE)) {
    if (name.startsWith('motion')) continue;
    signature.push(await bundle(name, source));
  }

  const shared = [];
  for (const version of ['react-19', 'react-18']) {
    const dir = join(ROOT, `consumers/.work/vite-${version}`);
    const entry = join(dir, 'react-cost.jsx');
    writeFileSync(entry, `export { createRoot, hydrateRoot } from 'react-dom/client'; export { useState, useEffect } from 'react'; export { jsx } from 'react/jsx-runtime';`);
    const result = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'esm', write: false, logLevel: 'silent', platform: 'browser', target: 'es2022', absWorkingDir: dir, define: { 'process.env.NODE_ENV': '"production"' } });
    shared.push({ name: version, gzip: gz(result.outputFiles[0].contents), brotli: br(result.outputFiles[0].contents) });
    rmSync(entry);
  }

  const css = [];
  const cssDir = join(CONSUMER, 'node_modules/@qbeka/react/dist/css');
  for (const [name, files] of Object.entries(CSS)) {
    const text = files.map((f) => readFileSync(join(cssDir, f))).join('\n');
    css.push({ name, files, raw: Buffer.byteLength(text), gzip: gz(Buffer.from(text)), brotli: br(Buffer.from(text)) });
  }
  const all = readFileSync(join(CONSUMER, 'node_modules/@qbeka/react/dist/styles.css'));
  css.push({ name: 'styles.css (all)', files: ['styles.css'], raw: all.length, gzip: gz(all), brotli: br(all) });

  rmSync(join(CONSUMER, '.size'), { recursive: true, force: true });
  return { method: 'esbuild bundle of the installed tarball, minified, ESM, React external, gzip level 9, brotli quality 11', versions, foundation, signature, shared, css };
}

/** Motion is measured from the docs app, which has it installed. */
export async function measureMotion() {
  const dir = join(ROOT, 'apps/docs');
  const out = [];
  for (const [name, source] of Object.entries(SIGNATURE)) {
    if (!name.startsWith('motion')) continue;
    const entry = join(dir, '.size-entry.jsx');
    writeFileSync(entry, source);
    const result = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'esm', jsx: 'automatic', write: false, external: REACT_EXTERNAL, logLevel: 'silent', platform: 'browser', target: 'es2022', absWorkingDir: dir, define: { 'process.env.NODE_ENV': '"production"' } });
    rmSync(entry);
    out.push({ name, gzip: gz(result.outputFiles[0].contents), brotli: br(result.outputFiles[0].contents) });
  }
  return out;
}
