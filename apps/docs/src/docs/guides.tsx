import type { ReactNode } from 'react';
import { Code } from '../lib/Copy';
import { Link } from '../lib/router';

export interface Guide {
  slug: string;
  title: string;
  body: () => ReactNode;
}

export const GUIDES: Guide[] = [
  {
    slug: 'install',
    title: 'Install',
    body: () => (
      <>
        <p>The package is built and tested as a tarball. It is not published to npm yet, so install that file.</p>
        <Code>{'pnpm add ./qbeka-react-0.1.0.tgz'}</Code>
        <p>Once it is published, this becomes:</p>
        <Code>{'pnpm add @qbeka/react'}</Code>
        <p>React and React DOM are peer dependencies. Versions 18.3 and 19 are tested in clean Vite and Next.js apps.</p>
        <h2>Import styles</h2>
        <p>Import everything at once:</p>
        <Code>{"import '@qbeka/react/styles.css';"}</Code>
        <p>Or import the tokens and only the parts you use:</p>
        <Code>{`import '@qbeka/react/css/tokens.css';
import '@qbeka/react/css/button.css';`}</Code>
        <p>All library CSS is in the <code>qendrim</code> cascade layer, so your own styles win without a specificity fight.</p>
        <h2>What an import does not do</h2>
        <ul>
          <li>It does not download a font. Set <code>--q-font-sans</code> or <code>--q-font-serif</code> to use your own.</li>
          <li>It does not load an icon catalog. The few icons are inline.</li>
          <li>It does not install a reset. Elements outside this library keep their styles.</li>
          <li>It does not need a provider around your app.</li>
        </ul>
      </>
    ),
  },
  {
    slug: 'contract',
    title: 'The contract',
    body: () => (
      <>
        <p>Most animated panels are right when left alone. This contract says what stays true when they are not.</p>
        <h2>The rules in short</h2>
        <ul>
          <li>The newest request wins. Each request gets a generation number, and work from an older generation is dropped.</li>
          <li>A move starts from where the panel is on screen, at the speed it is moving.</li>
          <li>The panel is one element for its whole life. Nothing is copied or moved to a new parent, so fields keep their text, caret and selection.</li>
          <li>Focus moves when you ask, not when the animation ends. You can type during a move.</li>
          <li>If a focus target is gone, focus goes to the next valid owner.</li>
          <li>Modal is a choice in code. A panel at the bottom of a phone stays nonmodal unless you used ModalInspector.</li>
          <li>With reduced motion, the same states and focus moves happen with no animation.</li>
        </ul>
        <h2>How a move works</h2>
        <ol>
          <li>Before React changes the page, read the box. <code>getSnapshotBeforeUpdate</code> is the only React API that runs at this moment.</li>
          <li>After React changes the page, read the natural box. This is the target.</li>
          <li>Write the old box back as inline styles, before the browser paints.</li>
          <li>Run a spring on position, size and radius. The spring is solved in closed form, so a retarget keeps position and velocity.</li>
          <li>Remove the inline styles, so CSS owns the element again.</li>
        </ol>
        <h2>Why not scale</h2>
        <p>Scale is cheaper per frame, and it stretches what is inside. Motion corrects children with a counter-scale, which works well for many things. A field someone is typing in is the case this library cares about most, so it animates real width and height. The cost is layout on each frame of a move. The <Link to="/evidence">evidence page</Link> measures that cost.</p>
        <h2>What is not promised</h2>
        <ul>
          <li>Continuity through replaced content. The box is continuous. New content appears at once.</li>
          <li>Text reflow. If a retarget changes the width, text wraps to its new width in one frame.</li>
          <li>Rotated ancestors. A bounding box cannot describe one, so the move goes straight to the target.</li>
          <li>Displayed frame rate. The channels are continuous in time, and a dropped frame is still dropped.</li>
        </ul>
        <p>The full contract is in <code>docs/CONTRACT.md</code>.</p>
      </>
    ),
  },
  {
    slug: 'usage',
    title: 'Using the components',
    body: () => (
      <>
        <h2>Controlled and uncontrolled</h2>
        <p>Components with state take <code>value</code> or <code>open</code> plus a change callback for controlled use. They take <code>defaultValue</code> or <code>defaultOpen</code> for uncontrolled use. <code>ActionBar</code> is controlled only, because its state always comes from your selection. <code>Surface</code> is controlled only, because a shape is a statement about your layout.</p>
        <h2>Refs</h2>
        <p>Every component forwards its ref to the main element, except <code>Tooltip</code> and <code>Select</code>. <code>Tooltip</code> renders no element of its own, so put the ref on the child. <code>Select</code> forwards to its trigger. <code>Surface</code> also takes <code>handleRef</code> for the imperative intent API.</p>
        <h2>Event composition</h2>
        <p>Your handlers run first. Inspector and foundation components merge props with Base UI's <code>mergeProps</code>. To stop the library's own handler, call <code>event.preventBaseUIHandler()</code>.</p>
        <Code>{`<Inspector.Trigger
  onClick={(event) => {
    if (hasUnsavedChanges) event.preventBaseUIHandler();
  }}
>`}</Code>
        <h2>Portals</h2>
        <p>Select, Popover, Dialog, Tooltip and ModalInspector render under <code>&lt;body&gt;</code>. Add <code>isolation: isolate</code> to your app's root element, as Base UI recommends. To put a popup somewhere else, pass <code>container</code>. Inspector never portals.</p>
        <p>If a recipe is on <code>&lt;html&gt;</code>, popups inherit it. If a recipe covers part of a page, wrap that part in <code>Scope</code>, which copies the recipe onto its popups.</p>
        <h2>Focus restoration</h2>
        <table>
          <thead><tr><th>Component</th><th>On open</th><th>On close</th><th>If the target is gone</th></tr></thead>
          <tbody>
            <tr><td>Inspector</td><td>First field, or the field you last used</td><td>Trigger, only if focus was inside</td><td>Your fallback, then the surface</td></tr>
            <tr><td>ModalInspector</td><td>First tabbable, from Base UI</td><td>Trigger</td><td>Your fallback</td></tr>
            <tr><td>Dialog, Popover, Select</td><td>Base UI defaults</td><td>Trigger</td><td>Set <code>finalFocus</code></td></tr>
            <tr><td>ActionBar</td><td>Does not move focus</td><td>Your fallback, only if focus was inside</td><td>Your fallback</td></tr>
          </tbody>
        </table>
        <h2>Disabled states</h2>
        <p><code>disabled</code> on Button, Input, Select and Tabs uses Base UI's handling. A <code>pending</code> Button is different. It ignores clicks and stays focusable, so a keyboard user keeps their place during a save.</p>
        <h2>Server and client</h2>
        <p>Every component file starts with <code>'use client'</code>. You can import and render them from a Next.js server component, including compound parts such as <code>Field.Root</code>. Props must be serializable there, so pass functions from a client component. The first HTML is complete: a closed Inspector is hidden by CSS from <code>data-shape</code>, so it needs no JavaScript to look right.</p>
        <p>Measurement and animation only start after hydration. Tokens and CSS have no JavaScript, so they are safe in a server layout.</p>
      </>
    ),
  },
  {
    slug: 'theming',
    title: 'Tokens and recipes',
    body: () => (
      <>
        <p>Everything visual is a CSS variable. Recipes change tokens and never components, so the same code serves a dense tool and a reading page.</p>
        <Code>{`<html data-q-recipe="studio" data-q-theme="dark">`}</Code>
        <table>
          <thead><tr><th>Group</th><th>Examples</th></tr></thead>
          <tbody>
            <tr><td>Color</td><td><code>--q-color-page</code>, <code>--q-color-ink</code>, <code>--q-color-accent</code></td></tr>
            <tr><td>Type</td><td><code>--q-font-control</code>, <code>--q-font-content</code>, <code>--q-text-md</code></td></tr>
            <tr><td>Space</td><td><code>--q-space-1</code> to <code>--q-space-6</code></td></tr>
            <tr><td>Radii</td><td><code>--q-radius-control</code>, <code>--q-radius-row</code>, <code>--q-radius-panel</code></td></tr>
            <tr><td>Borders</td><td><code>--q-border</code></td></tr>
            <tr><td>Motion</td><td><code>--q-surface-response</code>, <code>--q-surface-damping</code>, <code>--q-motion-fast</code></td></tr>
          </tbody>
        </table>
        <h2>Studio</h2>
        <p>For dense tools. A sans serif, 32 px controls, small radii and a quick spring.</p>
        <h2>Editorial</h2>
        <p>For reading pages. A serif, 40 px controls, pill buttons and a calmer spring. It uses <code>--font-geist-serif-regular</code> if your page defines it, and otherwise your system serif.</p>
        <h2>Light and dark</h2>
        <p>Without <code>data-q-theme</code>, the theme follows the system. Set it to <code>light</code> or <code>dark</code> to choose.</p>
        <h2>Fonts and icons</h2>
        <p>Both are opt-in, and neither ships in the package. Geist is under the SIL Open Font License. This site loads it itself, from files in its own repository.</p>
      </>
    ),
  },
  {
    slug: 'reduced-motion',
    title: 'Reduced motion',
    body: () => (
      <>
        <p>With <code>prefers-reduced-motion: reduce</code>, a request reaches its shape in the same task. The state changes, events and focus moves are the same, and only the animation is gone.</p>
        <ul>
          <li>Surface and Inspector skip the spring.</li>
          <li>Popups and dialogs skip their fades.</li>
          <li>The pending indicator on Button stops spinning and stays visible.</li>
          <li>Timeline playback steps from marker to marker once a second.</li>
        </ul>
      </>
    ),
  },
];
