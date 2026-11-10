/**
 * The long exposure of the panel: where its measured box, its corners and its caret have
 * been. Every mark is a reading of the real element on a real frame, so the drawing is a
 * record of the move and nothing else. It writes to a canvas, so watching adds no React
 * work, and it stops asking for frames once the drawing is still.
 */
import { EXPOSURE, leaveStrength, restStrength, stampDue, tailStrength, type Frame } from './exposure';

export interface TraceParts {
  canvas: HTMLCanvasElement;
  /** The moving element. */
  target: () => HTMLElement | null;
  /** The caret in viewport pixels, when a field in the panel has one. */
  caret: () => { x: number; y: number } | null;
  /** True while one move runs into the next with no rest, as when the panel is held. */
  continuous: () => boolean;
  /** False while the moves are too erratic for the corner paths to read, as in a storm of requests. */
  corners: () => boolean;
  /** Called on each frame that is read, for readouts that follow the move. */
  onFrame?: (box: { x: number; y: number; width: number; height: number }, moving: boolean) => void;
}

interface Run {
  frames: Frame[];
  lastStamp: Frame | null;
  /** When a newer drawing began, or 0 while this is the newest. */
  replacedAt: number;
  /** How strongly it showed at that moment. */
  strengthThen: number;
}

const CHUNK = 6;

export function createTrace({ canvas, target, caret, continuous, corners, onFrame }: TraceParts) {
  const context = canvas.getContext('2d');
  let runs: Run[] = [];
  let frame = 0;
  let ratio = 1;
  let lastFrameAt = -Infinity;
  /** Where the panel is now. The outlines stop at its edge, as if it lay on top of them. */
  let cover: { x: number; y: number; width: number; height: number; radius: number } | null = null;
  let accent = '29, 58, 42';
  let ink = '17, 21, 17';

  const rgb = (value: string, fallback: string) => {
    const parts = value.match(/\d+(\.\d+)?/g);
    return parts && parts.length >= 3 ? parts.slice(0, 3).join(', ') : fallback;
  };

  function readColors() {
    // The strokes follow the tokens, so the drawing is right in every theme.
    const style = getComputedStyle(canvas);
    accent = rgb(style.color, accent);
    ink = rgb(style.outlineColor, ink);
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    // A drawing made on a plan of another size no longer lines up with it.
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      runs = [];
    }
    readColors();
    draw(performance.now());
  }

  /** The outlines and the corner paths. The oldest outline of a run is the faintest, so the drawing has a direction. */
  function strokeBoxes(run: Run, strength: number) {
    if (!context || strength <= 0.004) return;
    const { frames } = run;
    const count = frames.length;
    const newest = run.replacedAt === 0;

    // Whole outlines: the box at even steps.
    context.lineWidth = 1;
    for (let i = 0; i < count; i += 1) {
      const f = frames[i] as Frame;
      if (!f.stamp) continue;
      const alpha = strength * (newest ? tailStrength(i, count) : 1) * (0.07 + 0.17 * (count > 1 ? i / (count - 1) : 1));
      if (alpha <= 0.004) continue;
      context.strokeStyle = `rgba(${ink}, ${alpha.toFixed(3)})`;
      context.beginPath();
      const radius = Math.max(Math.min(f.radius, f.width / 2, f.height / 2), 0);
      context.roundRect(f.x + 0.5, f.y + 0.5, Math.max(f.width - 1, 0), Math.max(f.height - 1, 0), radius);
      context.stroke();
    }

    // The path of each corner, through every frame.
    context.lineWidth = 0.75;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (let start = 0; start < count - 1; start += CHUNK) {
      const end = Math.min(start + CHUNK, count - 1);
      const alpha = strength * (newest ? tailStrength(start, count) : 1) * 0.34;
      if (alpha <= 0.004) continue;
      context.strokeStyle = `rgba(${accent}, ${alpha.toFixed(3)})`;
      context.beginPath();
      for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        for (let i = start; i <= end; i += 1) {
          const f = frames[i] as Frame;
          const px = f.x + sx * f.width;
          const py = f.y + sy * f.height;
          if (i === start || !f.corners) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
      }
      context.stroke();
    }
  }

  /** The caret: one firm line, with a dot wherever an outline was kept. */
  function strokeCaret(run: Run, strength: number) {
    if (!context || strength <= 0.004) return;
    const { frames } = run;
    const count = frames.length;
    const newest = run.replacedAt === 0;
    context.lineWidth = 1.5;
    for (let start = 0; start < count - 1; start += CHUNK) {
      const end = Math.min(start + CHUNK, count - 1);
      const alpha = strength * (newest ? tailStrength(start, count) : 1) * 0.95;
      if (alpha <= 0.004) continue;
      context.strokeStyle = `rgba(${accent}, ${alpha.toFixed(3)})`;
      context.beginPath();
      let pen = false;
      for (let i = start; i <= end; i += 1) {
        const f = frames[i] as Frame;
        if (f.caretX === null || f.caretY === null) {
          pen = false;
          continue;
        }
        if (pen) context.lineTo(f.caretX, f.caretY);
        else context.moveTo(f.caretX, f.caretY);
        pen = true;
      }
      context.stroke();
    }
    for (let i = 0; i < count; i += 1) {
      const f = frames[i] as Frame;
      if (!f.stamp || f.caretX === null || f.caretY === null) continue;
      const alpha = strength * (newest ? tailStrength(i, count) : 1);
      if (alpha <= 0.004) continue;
      context.fillStyle = `rgba(${accent}, ${alpha.toFixed(3)})`;
      context.beginPath();
      context.arc(f.caretX, f.caretY, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function draw(now: number) {
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const strength = (run: Run) => (run.replacedAt === 0 ? restStrength(now - lastFrameAt) : run.strengthThen * leaveStrength(now - run.replacedAt));
    context.save();
    if (cover) {
      const hole = new Path2D();
      hole.rect(0, 0, canvas.width / ratio, canvas.height / ratio);
      hole.roundRect(cover.x, cover.y, cover.width, cover.height, Math.max(Math.min(cover.radius, cover.width / 2, cover.height / 2), 0));
      context.clip(hole, 'evenodd');
    }
    for (const run of runs) strokeBoxes(run, strength(run));
    for (const run of runs) strokeCaret(run, strength(run));
    context.restore();
  }

  function record(now: number, element: HTMLElement, box: DOMRect, origin: DOMRect) {
    let run = runs.at(-1);
    const joined = run && run.replacedAt === 0 && (continuous() || now - lastFrameAt <= EXPOSURE.joinMs);
    if (!run || !joined) {
      if (run && run.replacedAt === 0) {
        run.strengthThen = restStrength(now - lastFrameAt);
        run.replacedAt = now;
      }
      run = { frames: [], lastStamp: null, replacedAt: 0, strengthThen: 1 };
      runs.push(run);
    }
    const at = caret();
    const next: Frame = {
      t: now,
      x: box.left - origin.left,
      y: box.top - origin.top,
      width: box.width,
      height: box.height,
      radius: cover?.radius ?? 0,
      caretX: at ? at.x - origin.left : null,
      caretY: at ? at.y - origin.top : null,
      stamp: false,
      corners: corners(),
    };
    next.stamp = stampDue(next, run.lastStamp, continuous() ? EXPOSURE.stampMinPxContinuous : EXPOSURE.stampMinPx);
    if (next.stamp) run.lastStamp = next;
    run.frames.push(next);
    if (run.frames.length > EXPOSURE.capacity) run.frames.shift();
    lastFrameAt = now;
  }

  function tick(now: number) {
    frame = 0;
    const element = target();
    const moving = element?.dataset['phase'] === 'moving';
    if (element) {
      const box = element.getBoundingClientRect();
      const origin = canvas.getBoundingClientRect();
      cover = { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height, radius: Number.parseFloat(element.style.borderRadius || getComputedStyle(element).borderTopLeftRadius) || 0 };
      if (moving) record(now, element, box, origin);
      onFrame?.({ x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height }, moving);
    }
    runs = runs.filter((run) => run.replacedAt === 0 || now - run.replacedAt < EXPOSURE.leaveMs);
    draw(now);
    const settling = now - lastFrameAt < EXPOSURE.restMs * 6;
    if (moving || continuous() || runs.length > 1 || (runs.length === 1 && settling)) frame = requestAnimationFrame(tick);
  }

  return {
    /** Starts reading if it is not already. Call it whenever a move begins. */
    kick() {
      if (!frame) frame = requestAnimationFrame(tick);
    },
    resize,
    /** How many frames the newest drawing holds. Tests read it. */
    size: () => runs.at(-1)?.frames.length ?? 0,
    clear() {
      runs = [];
      draw(performance.now());
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      runs = [];
    },
  };
}
