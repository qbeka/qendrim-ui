# The continuity contract

This is the behavior `Surface` and `Inspector` promise. A section marked "Not promised" is a limit, not a to-do. `docs/REPORT.md` maps the rules to the tests that cover them, and names what has no test.

## Words used here

- **Shape**: a named layout for a surface, such as `row`, `panel` or `sheet`. CSS decides what a shape looks like.
- **Desired shape**: the shape the user most recently asked for. It changes in the same commit as the request.
- **Rendered shape**: the last shape the surface fully reached.
- **Generation**: a counter that goes up each time a new intent arrives. It is the ownership token for pending work.
- **Visible box**: where the surface is on screen at this moment, read from the browser.
- **Natural box**: where the surface would be with no animation applied. This is the target.
- **Local pixels**: CSS pixels inside the surface's own coordinate space, after undoing ancestor scale.

## State model

The state model has no DOM, no timers and no React. It lives in `packages/react/src/core/machine.ts`.

| Rule | Statement |
|---|---|
| M1 | A request for a new shape sets the desired shape, adds one to the generation and enters `moving`. |
| M2 | A request for the shape that is already desired does nothing. A double click is one request. |
| M3 | A completion carries the generation it belongs to. It commits only if that generation is still current. |
| M4 | A stale completion is dropped and traced. It changes nothing. |
| M5 | `invalidate()` adds one to the generation without changing the shape. Use it for a newer intent that is not a shape change, such as typing during a deferred close. |
| M6 | After `destroy()` every request and completion is dropped. |
| M7 | The rendered shape only ever becomes a shape that was the desired shape at that moment. |

M3 is the rule that stops an older close from closing a reopened surface.

## Geometry

The engine animates one element, in place. It never clones and never moves the element to a new parent.

1. Before React changes the DOM, read the visible box. `getSnapshotBeforeUpdate` is the only React API that runs at this moment. This is why `Surface` contains one class component.
2. After React changes the DOM, clear the engine's inline styles and read the natural box. This is the target.
3. Lock the size to the visible box and read where layout puts it at that size. A box anchored right, bottom or center moves with its size, so this position is not the natural one.
4. Set `translate` to the difference, before paint. The first frame lands exactly on the visible box.
5. Run a spring on each channel to the natural box.
6. At the end, put the consumer's inline styles back, so ordinary CSS owns the element again.

### Channels

There are five: `dx`, `dy`, `width`, `height` and `radius`. Each channel is a damped spring solved in closed form, so sampling at any time is exact and does not depend on frame rate.

On a retarget, the engine reads the value from the visible box and keeps the velocity from the running spring. So the box does not jump at a retarget, and each channel keeps its velocity. If a retarget changes how a box is anchored, such as a row becoming a bottom sheet, the on-screen speed can still change at that moment, because the same `dx` then means something else. The position stays continuous.

### Why real width and height and not scale

Scale makes a retarget cheap and stretches its contents. A text field that is mid-edit must not look stretched, and the caret and the selection must stay where they are. So the engine writes real `width` and `height`, and the content box is locked to its target width during a move. The cost is one layout per frame during a move, scoped by the size of what depends on the surface. `docs/REPORT.md` measures that cost.

### Coordinate spaces

| Situation | Behavior |
|---|---|
| Nested scrolling | `dx` and `dy` are offsets from the element's own layout box. If an ancestor scrolls during a move, the box and the offset move together, so no correction is needed. Both boxes are read in one task, so a scroll cannot land between them. |
| `position: fixed` shapes | The natural box is fixed to the viewport, or to a transformed ancestor if one exists. The engine only reads boxes, so both cases work without a special path. |
| Ancestors with translate, scale or CSS zoom | The engine walks the ancestors at each measurement and divides by their scale to get local pixels. |
| Ancestors with rotation, skew or mirroring | A bounding box cannot describe these, so the engine goes straight to the target with no animation. |
| Viewport change during a move | The engine measures the natural box again at the next frame and retargets. At most one forced layout per frame. |
| Viewport change at rest | No animation. The surface follows ordinary layout, because a window drag should not lag. |
| Scroll position | Clearing inline styles can make a page shorter for one read, and the browser may clamp the scroll position. The engine saves and restores the scroll position of scrolled ancestors around that read. |

### Content changes

`ResizeObserver` watches the content box. It runs after layout and before paint, so the engine can respond with no visible jump.

| Situation | Behavior |
|---|---|
| Height changes during a move | The height channel gets a new target. Velocity is kept. No DOM read. |
| Height changes at rest, width unchanged | The surface locks height at its old value and springs to the new one. The engine reads the root's real height, so padding, borders and `min-height` count. If the root does not change, nothing moves. |
| Width changes at rest | This is a layout change. The surface follows it directly. |
| Observer fires repeatedly | Each callback updates one number. The frame loop does the only write, once per frame. |
| Natural box differs at the end of a move | The engine corrects with a second move, at most twice per generation, then accepts the natural box. |

The content box itself reflows at most once per retarget. It is not resized on every frame.

## Input and focus

| Rule | Statement |
|---|---|
| F1 | The surface keeps the same element for its whole life, so input values and selections survive every transition, and scroll positions hold during every move. A fresh open focuses the first field, and the browser scrolls to it. |
| F2 | Nothing interactive is duplicated. A temporary clone, if one is ever added, must be `inert`, `aria-hidden` and removed after use. |
| F3 | Opening moves focus when the request happens, not when the animation ends. The user can type during the move. |
| F4 | Closing moves focus out of the panel when the request happens, but only if focus was inside it. If the user already moved focus elsewhere, the surface leaves it alone. |
| F5 | Reopening during a close returns focus to the element that had it. A fresh open after the close finished starts again from `initialFocus` or the first field. |
| F6 | If the element holding focus goes away, focus moves to the next valid owner. In an open panel that is the first field, then the trigger, then the declared fallback, then the surface root. This covers a removed surface, a removed trigger, a removed field and a control that became disabled. If the user had already moved focus elsewhere, it stays there. Each move is traced with its reason. |
| F7 | Modal behavior is an explicit choice in code: `ModalInspector` instead of `Inspector`. Layout never changes it. A panel at the bottom of a small screen stays nonmodal. |

A closing panel is `inert` from the moment of the close request, modal or not, so a user cannot tab into something that is leaving.

## Reduced motion

With `prefers-reduced-motion: reduce`, requests take the same path and reach the requested shape in the same task. Events, focus moves and state changes are the same. Only the animation is gone.

## Cleanup

Unmounting cancels the frame loop, disconnects the observers, removes listeners, restores inline styles and destroys the state model. Pending completions are dropped by M6.

If focus was inside a surface that is being removed, the layout effect cleanup sees it before the DOM node goes, and focus moves to the next valid owner (F6).

## Engine internals

The engine's own frame loop only ever completes the current generation, because a new request replaces the running move. So M3 and M4 do not guard the loop. They guard everything else: `ifCurrent` and `closeAfter`, where work finishes later.

CSS transitions on `width`, `height`, `translate` or radius would fight the engine. If a transition list names any of these, or `all`, the whole list on that element is switched off for the move and restored after it. That includes any color transition in the same list. Put color transitions on a child if you need both.

## Not promised

- **Continuity through content replacement.** If new content is swapped in during a move, the box stays continuous and the content does not. There is no crossfade.
- **Continuity across layout models for the content.** The content reflows once at a retarget that changes its width. Text wraps to its new line length in that frame.
- **Smoothness of every property.** Only the five channels are continuous. Colors and shadows defined by a shape change follow your own CSS transition, if any.
- **Mathematical continuity on screen.** The channels are continuous as functions of time. The screen samples them at frame boundaries, and a dropped frame is a dropped frame.
- **Rotated or mirrored ancestors.** See above.
- **Corners that differ, and percentage radii.** One number cannot describe them, so they change in one step. The other channels still animate.
- **Changing `width`, `height`, `translate`, `border-radius` or `overflow` in the `style` prop during a move.** The engine restores the values from the start of the move, so make that change at rest.
- **A root that changes height through CSS alone at rest,** such as a new `min-height`, is not tracked. It follows layout, with no animation.
- **Surfaces that move to another document or to a portal mid-flight.** The element keeps one parent for its whole life.
