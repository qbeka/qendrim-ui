# Research notes

Sources were read on 2026-11-06. Versions are the ones installed from npm on that day.

## Pinned versions

| Package | Version | Why this one |
|---|---|---|
| `@base-ui/react` | 1.9.0 | Current stable. MIT. Peer range is React 17 to 19, and `@base-ui-components/react` is the old name. |
| `motion` | 14.9.1 | Current stable. Used only for the baselines. |
| `react`, `react-dom` | 19.3.1 for development | Peer range tested at 18.3.1, 19.0.0 and 19.3.1. |
| `typescript` | 7.0.2 in the workspace, 5.9.3 in the consumers | The consumers check that declarations work with the compiler most projects use today. |
| `vite` | 8.3.6 | Docs and consumer. |
| `next` | 16.1.6 and 16.4.5 | The first is what the portfolio has installed. |
| `@playwright/test` | 1.65.0 | Browser tests. |

## Base UI

Source: https://base-ui.com/react/overview/quick-start, plus the installed package.

- Parts are imported per component, from subpaths such as `@base-ui/react/popover`. This library follows the same shape.
- Popups use portals. The docs ask for `isolation: isolate` on the app root. This library repeats that advice.
- The docs suggest `position: relative` on `body` and absolute backdrops for iOS 26 Safari. **Not adopted yet:** the modal backdrop is fixed. iOS was not available for testing. See the limits in `docs/REPORT.md`.
- `Dialog.Root` takes `actionsRef`, with an `unmount` action, so an external animation can control when the popup leaves. ModalInspector depends on this. I confirmed it in the installed type declarations, not only in the docs.
- `keepMounted` hides a closed popup with the `hidden` attribute, which leaves no box to measure. ModalInspector drops that attribute and uses `visibility` instead. This relies on a detail of Base UI's output, so it is the first thing to check on an upgrade.
- `mergeProps` runs the rightmost handler first, and `preventBaseUIHandler` lets it stop the others. So consumer props go on the right.

## Motion

Source: https://motion.dev/docs/react-layout-animations.

- `layout` animates with `transform` and corrects children with counter-scale. Border distortion and the need for child `layout` props are documented limits.
- Motion says its animations can be interrupted, and that layout animation is blocked during horizontal window resizing.
- **Adopted:** the idea that the old box is read before the update and the new one after. This is the FLIP technique, and Motion is the best-known implementation in React.
- **Different:** this library animates real width and height with no scale, because the priority is a text field mid-edit. That costs layout on each frame. It also never crossfades or reparents, so it covers fewer cases than `layoutId`.
- **Not claimed:** that Motion is inferior. Comparison 2 in the report shows what each approach does on this fixture.

## WAI-ARIA Authoring Practices, modal dialog

Source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/.

- Tab and Shift+Tab stay inside, Escape closes, focus returns to the invoking element, and if that element is gone focus goes to one that fits the workflow.
- Only mark a dialog modal if the app blocks everything outside it and the visuals obscure that content.
- **Adopted:** ModalInspector leaves all of this to Base UI Dialog. The fallback rule became F6 in the contract. Nonmodal panels do not claim the dialog role.

## Vercel Web Interface Guidelines

Source: https://vercel.com/design/guidelines. Used as a checklist of principles. No code, name or asset came from it.

- Adopted: animations are cancelable by input. `overscroll-behavior: contain` in sheets. `:focus-visible` rings. A loading button keeps its label. Inline validation that says how to fix the problem. `touch-action: manipulation`. 24 px hit targets, 44 px on touch. Ellipsis on loading text. Inputs at 16 px or more on touch.
- Different: the guidelines prefer animating only transform and opacity. This library animates `width` and `height` on purpose and measures the cost. The reason is in the contract.
- Adopted in spirit: move focus to the first error on submit. The project example does this.

## Geist

Source: https://vercel.com/geist/introduction. Studied as an example of a system with foundations, then components. This library has its own tokens, its own recipes and no shared identity. Geist Sans and Geist Serif are used on the documentation site under the Open Font License. They do not ship in the package.

## Interaction reasoning

Sources: https://rauno.me/craft/interaction-design and https://rauno.me/craft/novelty.

- From the first: an interface should respond to a change of mind mid-motion. That is the idea behind this whole library. Motion should show where things come from.
- From the second: novelty wears out on frequent actions. Foundation components therefore have no signature motion at all: a color change or a short fade. Only the panel moves, and only when it opens.

## shadcn registry

Source: https://ui.shadcn.com/docs/registry. Source distribution is possible later. It was left out of this release, as the brief says to add it only after the package works.

## Names

| Name | Checked on 2026-11-06 |
|---|---|
| `qbeka/qendrim-ui` on GitHub | Not found, so it is free. |
| `@qbeka/react` on npm | 404, so it is free. The `@qbeka` scope must be owned by the npm account that publishes it. |
| `qendrim-ui` on npm | 404. |

A web search for an unrelated product named Qendrim UI was not run, because the name is the author's own given name.
