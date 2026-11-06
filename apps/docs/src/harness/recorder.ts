/**
 * Records one sample per animation frame, plus events. It only reads, once per frame,
 * after the frame's rendering work. Its own requestAnimationFrame is taken before any
 * counting wrapper is installed.
 * Reading getBoundingClientRect here can force layout, so timing runs in the benchmarks
 * leave the recorder off. See docs/PREREGISTRATION.md.
 */

import type { HarnessEvent, Requested, Sample, Trace } from './types';

const nativeRaf = window.requestAnimationFrame.bind(window);
const nativeCancel = window.cancelAnimationFrame.bind(window);

export interface RecorderSource {
  root: () => HTMLElement | null;
  requested: () => Requested;
  rendered: () => Requested;
}

function focusLabel(root: HTMLElement | null): string {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body) return 'body';
  const probe = active.dataset['probe'];
  if (probe) return probe;
  const box = root?.querySelector('[data-probe="box"]');
  if (box?.contains(active)) return active.tagName.toLowerCase();
  return 'outside';
}

/**
 * Drawn size over layout size. offsetWidth rounds to a whole pixel, so it reads a fractional
 * field as stretched. Computed style gives the fractional layout size, before transforms.
 */
function drawnScale(input: HTMLInputElement | null | undefined, rect: DOMRect | undefined) {
  if (!input || !rect) return { inputScaleX: 1, inputScaleY: 1 };
  const style = getComputedStyle(input);
  const extraWidth = style.boxSizing === 'border-box' ? 0 : parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const extraHeight = style.boxSizing === 'border-box' ? 0 : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const width = parseFloat(style.width) + extraWidth;
  const height = parseFloat(style.height) + extraHeight;
  return { inputScaleX: width ? rect.width / width : 1, inputScaleY: height ? rect.height / height : 1 };
}

/** Copies of the field that a person could actually reach. */
function countInteractive(root: HTMLElement): number {
  let count = 0;
  for (const input of root.querySelectorAll<HTMLElement>('[data-probe="input"]')) {
    if (!input.closest('[inert],[aria-hidden="true"]') && input.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)) count += 1;
  }
  return count;
}

export class Recorder {
  samples: Sample[] = [];
  events: HarnessEvent[] = [];
  private frame = 0;
  private running = false;
  private readonly source: RecorderSource;
  /** Called after each sample. The workbench uses this to draw. */
  onSample?: (sample: Sample) => void;

  constructor(source: RecorderSource) {
    this.source = source;
  }

  private readonly onResize = () => this.mark('viewport');

  mark(type: string, detail?: unknown) {
    // Off means off. A stored focus event holds a DOM element, which would keep it alive
    // and show up as a leak in the library.
    if (!this.running) return;
    this.events.push({ t: performance.now(), type, detail });
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('resize', this.onResize);
    // Sample after the frame, not in it. requestAnimationFrame runs before layout and
    // before ResizeObserver, so a read there can see a size that is never painted. A
    // message posted from the frame is delivered once the frame's rendering work is done.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (this.running) this.capture();
    };
    const tick = () => {
      if (!this.running) return;
      channel.port2.postMessage(0);
      this.frame = nativeRaf(tick);
    };
    this.frame = nativeRaf(tick);
  }

  stop() {
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    nativeCancel(this.frame);
  }

  reset() {
    this.samples = [];
    this.events = [];
  }

  capture() {
    const root = this.source.root();
    const box = root?.querySelector<HTMLElement>('[data-probe="box"]');
    const input = root?.querySelector<HTMLInputElement>('[data-probe="input"]');
    if (!root || !box) return;
    const rect = box.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const inRect = !!inputRect && inputRect.height > 0 && inputRect.bottom > rect.top && inputRect.top < rect.bottom - 1;
    const sample: Sample = {
      t: performance.now(),
      height: rect.height,
      width: rect.width,
      x: rect.left,
      y: rect.top,
      requested: this.source.requested(),
      rendered: this.source.rendered(),
      focus: focusLabel(root),
      ...drawnScale(input, inputRect),
      interactive: countInteractive(root),
      inputVisible: !!input && inRect && input.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions),
      value: input?.value ?? '',
      inputTop: inputRect ? inputRect.top - rect.top : 0,
    };
    this.samples.push(sample);
    this.onSample?.(sample);
  }

  trace(): Trace {
    return { samples: this.samples, events: this.events };
  }
}
