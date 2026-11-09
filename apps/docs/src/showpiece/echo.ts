/**
 * Draws where the panel has just been: one outline every few frames, fading out. Every
 * outline is the panel's measured box at that moment, so the drawing is a record of the
 * move and nothing else. It runs only while the panel is moving or an outline is still
 * visible, and writes to a canvas, so watching adds no React work.
 */
const STAMP_EVERY_MS = 34;
const LIFE_MS = 1500;
const MAX_STAMPS = 96;

export interface EchoParts {
  canvas: HTMLCanvasElement;
  /** The moving element. */
  target: () => HTMLElement | null;
  /** Called on each sampled frame, for readouts that follow the move. */
  onFrame?: (box: DOMRect, moving: boolean) => void;
}

interface Stamp {
  at: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export function createEcho({ canvas, target, onFrame }: EchoParts) {
  const context = canvas.getContext('2d');
  let stamps: Stamp[] = [];
  let frame = 0;
  let lastStamp = 0;
  let ratio = 1;
  let color = '29, 58, 42';

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    // The stroke follows the accent token, so the drawing is right in every theme.
    const probe = getComputedStyle(canvas).color.match(/\d+(\.\d+)?/g);
    if (probe && probe.length >= 3) color = probe.slice(0, 3).join(', ');
    draw(performance.now());
  }

  function draw(now: number) {
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 1;
    for (const stamp of stamps) {
      const age = (now - stamp.at) / LIFE_MS;
      if (age >= 1) continue;
      const fade = (1 - age) * (1 - age);
      context.strokeStyle = `rgba(${color}, ${(0.34 * fade).toFixed(3)})`;
      context.beginPath();
      const radius = Math.max(Math.min(stamp.radius, stamp.width / 2, stamp.height / 2), 0);
      context.roundRect(stamp.x + 0.5, stamp.y + 0.5, Math.max(stamp.width - 1, 0), Math.max(stamp.height - 1, 0), radius);
      context.stroke();
    }
  }

  function tick(now: number) {
    frame = 0;
    const element = target();
    const moving = element?.dataset['phase'] === 'moving';
    if (element) {
      const box = element.getBoundingClientRect();
      if (moving && now - lastStamp >= STAMP_EVERY_MS) {
        const origin = canvas.getBoundingClientRect();
        lastStamp = now;
        stamps.push({ at: now, x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height, radius: Number.parseFloat(element.style.borderRadius || getComputedStyle(element).borderTopLeftRadius) || 0 });
        if (stamps.length > MAX_STAMPS) stamps.shift();
      }
      onFrame?.(box, moving);
    }
    stamps = stamps.filter((stamp) => now - stamp.at < LIFE_MS);
    draw(now);
    if (moving || stamps.length > 0) frame = requestAnimationFrame(tick);
  }

  return {
    /** Starts sampling if it is not running. Call it whenever a move begins. */
    kick() {
      if (!frame) frame = requestAnimationFrame(tick);
    },
    resize,
    clear() {
      stamps = [];
      draw(performance.now());
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      stamps = [];
    },
    /** How many outlines are on the canvas. The tests read it. */
    count: () => stamps.length,
  };
}
