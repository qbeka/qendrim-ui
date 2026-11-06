/**
 * Draws one line: the measured height of the list against time spent moving. It writes to
 * the DOM directly and only while something moves, so watching the panel adds no React work.
 */
const WINDOW_MS = 5000;
const MAX_FRAME_MS = 34; // A dropped frame should not read as a long flat run.
const MIN_RANGE_PX = 160; // So a small change stays a small mark on the line.
const HEIGHT = 40;
const WIDTH = 1000;

export interface TrackParts {
  line: SVGPathElement;
  marks: SVGPathElement;
  head: HTMLElement;
  list: HTMLElement;
  onFrame: (height: number, moving: boolean) => void;
}

export function createTrack({ line, marks, head, list, onFrame }: TrackParts) {
  let samples: { t: number; height: number }[] = [];
  let interruptions: number[] = [];
  let clock = 0;
  let last = 0;
  let frame = 0;
  let floor = Number.POSITIVE_INFINITY;
  let ceiling = 0;

  const moving = () => list.querySelector('[data-q-surface][data-phase="moving"]') !== null;
  const y = (height: number) => HEIGHT - 1 - ((height - floor) / (ceiling - floor)) * (HEIGHT - 2);

  function draw() {
    const shift = Math.max(clock - WINDOW_MS, 0);
    const place = (t: number) => ((t - shift) / WINDOW_MS) * WIDTH;
    let d = '';
    for (const sample of samples) d += `${d ? 'L' : 'M'}${place(sample.t).toFixed(1)} ${y(sample.height).toFixed(1)}`;
    line.setAttribute('d', d);
    marks.setAttribute('d', interruptions.map((t) => `M${place(t).toFixed(1)} 0V${HEIGHT}`).join(''));
    const end = samples.at(-1);
    if (end) head.style.translate = `${(place(end.t) / WIDTH) * head.parentElement!.clientWidth}px ${((y(end.height) / HEIGHT) * head.parentElement!.clientHeight).toFixed(1)}px`;
    head.dataset['on'] = samples.length > 1 ? 'true' : 'false';
  }

  function tick(now: number) {
    const height = list.getBoundingClientRect().height;
    clock += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    floor = Math.min(floor, height);
    ceiling = Math.max(ceiling, height, floor + MIN_RANGE_PX);
    samples.push({ t: clock, height });
    const oldest = clock - WINDOW_MS;
    while (samples.length > 2 && (samples[1] as { t: number }).t < oldest) samples.shift();
    interruptions = interruptions.filter((t) => t >= oldest);
    draw();
    const still = moving();
    onFrame(height, still);
    frame = still ? requestAnimationFrame(tick) : 0;
  }

  return {
    /** Starts sampling, if it is not running. Call it whenever a move begins. */
    kick() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    /** Marks this moment on the line. */
    mark() {
      interruptions.push(clock);
    },
    clear() {
      samples = [];
      interruptions = [];
      clock = 0;
      floor = Number.POSITIVE_INFINITY;
      ceiling = 0;
      line.setAttribute('d', '');
      marks.setAttribute('d', '');
      head.dataset['on'] = 'false';
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
