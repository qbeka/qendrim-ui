# Design record

## Who this is for

A product engineer building a tool with panels that people edit in: an inspector, a review drawer, a settings pane. They already know Base UI, Radix or Motion. They want a panel that keeps working when the user changes their mind.

## The problem

Most animated panels are correct when left alone. They break when interrupted. A close that finishes after a reopen hides the panel. A restart jumps. A clone steals focus. A scale stretches the field the user is typing in. Each bug is small, and each one lands on someone mid-task.

## The primary task

Open a compact row into an editor, change something, and leave, in whatever order the user decides, without the interface losing what they were doing.

## Two approaches to the central workflow

### A. Shared element with a portal (rejected)

```
row (in list)  ── click ──▶  portal clone flies to panel  ──▶  panel mounts, row hides
```

The row and panel are two elements, and a shared-layout animation connects them. Motion's `layoutId` does this well, and it is the fastest way to make a demo. It fails the brief for this library:

- The element changes, so input state has to be copied or lifted.
- During a reverse, two elements exist. One must be inert, and focus has to move between them.
- Scale correction leaves text and borders distorted for the length of the move, and it is most visible on a text field.

### B. One element, many shapes (chosen)

```
<Surface shape="row">           the same element for its whole life
   row content                  CSS decides what each shape looks like
   editor content               the engine animates between CSS layouts
</Surface>
```

The row *is* the panel. A shape is a CSS rule, so a media query can turn the panel into a bottom sheet with no JavaScript. The engine never needs to know why the layout changed. It reads where the box was and where the box should be.

The price is real layout on each frame of a move. Comparison 2 in `docs/REPORT.md` measures the price against Motion and against CSS.

## Sketch: project inspector

```
┌────────────────────────────────────────────────┐
│ Harbor rebuild      Active      Due 12 Jan   ▾ │  row, 52 px
├────────────────────────────────────────────────┤
│ Field survey        Paused      Due 3 Feb    ▾ │
└────────────────────────────────────────────────┘
                     │ click, Enter or Space
                     ▼
┌────────────────────────────────────────────────┐
│ Harbor rebuild      Active      Due 12 Jan   ▴ │  same element
│  Name    [Harbor rebuild            ]          │  focus lands here at once
│  Budget  [1200000      ]  ← validation error   │  error grows the panel
│  ▸ Details                                     │  growth retargets the move
│  [Save]  [Save and close]   Saved 2 min ago    │
├────────────────────────────────────────────────┤
│ Field survey …                                 │  pushed down, continuously
└────────────────────────────────────────────────┘
```

Nonmodal. Tab leaves the panel into the next row. Escape closes and returns focus to the row.

## Sketch: receipt review

```
┌ Receipts, October ───────────────────────┐   ┌ Review ────────────────┐
│ ☐ Harbor Grocer     42.18   Sam          │   │ Harbor Grocer          │
│ ☑ Night Train        9.50   You          │──▶│ Amount [42.18 ] Paid by│
│ ☑ Corner Pharmacy   17.25   You          │   │ Split  [Even ▾]        │
│                                          │   │ ├──●───◆───◆──┤ timeline│
│ ┌ 2 selected  Approve  Split  Undo ┐     │   │ [Approve]  [Reject]    │
└─┴──────────────────────────────────┴─────┘   └────────────────────────┘
```

Modal, using the dialog contract from Base UI, opening from the row it belongs to. The action bar sits above the list and takes no layout space, so choosing a row never moves the list. Data is synthetic.

## Shape of the documentation

Option one was a component catalog with a sidebar. Option two opens on one working inspector with an install command under it, then a short path to the other pages. The second teaches the purpose of the library first, so the catalog comes after it.

## Rejected: a global animation provider

A provider would make coordinating siblings easier, since Motion's `LayoutGroup` shows what is possible. It would also be a new requirement for every app, and the brief rules it out. Each `Surface` owns itself, and siblings in a list move because they are in normal flow.

## Visual direction

- Warm white, dark ink, one forest accent, thin rules.
- Studio: a readable sans serif, dense, 32 px controls.
- Editorial: a serif for content, a calm column, 40 px controls.
- The mark of the documentation is one hairline: the real measured height of a surface while it reverses. It comes from the instrument, not from decoration.
