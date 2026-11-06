# The continuity contract

This is the behavior `Surface` and `Inspector` promise. Everything here has a test or a stated limit.
A section marked "Not promised" is a limit, not a to-do.

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
2. After React changes the DOM, clear inline styles and read the natural box. This is the target.
3. Write the visible box back as inline `width`, `height`, `translate` and `border-radius`, before paint.
4. Run a spring on each channel from the visible box to the natural box.
5. At the end, remove the inline styles so ordinary CSS owns the element again.

### Channels

There are five: `dx`, `dy`, `width`, `height` and `radius`. Each channel is a damped spring solved in closed form, so sampling at any time is exact and does not depend on frame rate.

On a retarget, the engine reads the value from the visible box and keeps the velocity from the running spring. Position and velocity are therefore continuous on these five channels at each retarget.

### Why real width and height and not scale

Scale makes a retarget cheap and stretches its contents. A text field that is mid-edit must not look stretched, and the caret and the selection must stay where they are. So the engine writes real `width` and `height`, and the content box is locked to its target width during a move. The cost is one layout per frame during a move, scoped by the size of what depends on the surface. `docs/REPORT.md` measures that cost.

### Coordinate spaces

| Situation | Behavior |
|---|---|
| Nested scrolling | `dx` and `dy` are offsets from the element's own layout box. If an ancestor scrolls during a move, the box and the offset move together, so no correction is needed. Both boxes are read in one task, so a scroll cannot land between them. |
| `position: fixed` shapes | The natural box is fixed to the viewport, or to a transformed ancestor if one exists. The engine only reads boxes, so both cases work without a special path. |
| Ancestors with translate or scale | The engine walks the ancestors at each measurement and divides by their scale to get local pixels. |
| Ancestors with rotation or skew | A bounding box cannot describe a rotated element, so the engine goes straight to the target with no animation. |
| Viewport change during a move | The engine measures the natural box again at the next frame and retargets. At most one forced layout per frame. |
| Viewport change at rest | No animation. The surface follows ordinary layout, because a window drag should not lag. |
| Scroll position | Clearing inline styles can make a page shorter for one read, and the browser may clamp the scroll position. The engine saves and restores the scroll position of scrolled ancestors around that read. |

### Content changes

`ResizeObserver` watches the content box. It runs after layout and before paint, so the engine can respond with no visible jump.

| Situation | Behavior |
|---|---|
| Height changes during a move | The height channel gets a new target. Velocity is kept. No DOM read. |
| Height changes at rest, width unchanged | The surface locks height at its old value and springs to the new one. |
| Width changes at rest | This is a layout change. The surface follows it directly. |
| Observer fires repeatedly | Each callback updates one number. The frame loop does the only write, once per frame. |
| Natural box differs at the end of a move | The engine corrects with a second move, at most twice per generation, then accepts the natural box. |

The content box itself reflows at most once per retarget. It is not resized on every frame.

## Input and focus

| Rule | Statement |
|---|---|
| F1 | The surface keeps the same element for its whole life, so input values, selections and scroll positions survive every transition. |
| F2 | Nothing interactive is duplicated. A temporary clone, if one is ever added, must be `inert`, `aria-hidden` and removed after use. |
| F3 | Opening moves focus when the request happens, not when the animation ends. The user can type during the move. |
| F4 | Closing moves focus out of the panel when the request happens, but only if focus was inside it. If the user already moved focus elsewhere, the surface leaves it alone. |
| F5 | Reopening during a close returns focus to the element that had it. |
| F6 | If the focus target is gone, focus goes to the next valid owner: trigger, then the declared fallback, then the surface root. Each step is logged with its reason. |
| F7 | Modal behavior is an explicit choice in code: `ModalInspector` instead of `Inspector`. Layout never changes it. A panel at the bottom of a small screen stays nonmodal. |

A close panel is `inert` from the moment of the close request, so a user cannot tab into something that is leaving.

## Reduced motion

With `prefers-reduced-motion: reduce`, requests take the same path and reach the requested shape in the same task. Events, focus moves and state changes are the same. Only the animation is gone.

## Cleanup

Unmounting cancels the frame loop, disconnects the observer, removes listeners, clears inline styles and destroys the state model. Pending completions are dropped by M6.

If focus was inside a surface that is being removed, the layout effect cleanup sees it before the DOM node goes, and focus moves to the next valid owner (F6).

## Not promised

- **Continuity through content replacement.** If new content is swapped in during a move, the box stays continuous and the content does not. There is no crossfade.
- **Continuity across layout models for the content.** The content reflows once at a retarget that changes its width. Text wraps to its new line length in that frame.
- **Smoothness of every property.** Only the five channels are continuous. Colors and shadows defined by a shape change follow your own CSS transition, if any.
- **Mathematical continuity on screen.** The channels are continuous as functions of time. The screen samples them at frame boundaries, and a dropped frame is a dropped frame.
- **Rotated ancestors.** See above.
- **Surfaces that move to another document or to a portal mid-flight.** The element keeps one parent for its whole life.
