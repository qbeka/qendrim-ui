/**
 * Work that can wait for a quiet moment, done one piece at a time. The page uses it to load
 * what is below the first screen and to let the browser render it, so that none of it lands
 * in one long task. Nothing here runs until the gate is opened, which the page does once the
 * first screen and the chapters are in.
 */
type Task = () => void;

const queue: Task[] = [];
let open = false;
let running = false;

const idle: (task: Task) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (task) => { window.requestIdleCallback(task, { timeout: 500 }); }
    : (task) => { window.setTimeout(task, 60); };

function pump() {
  if (!open || running) return;
  const task = queue.shift();
  if (!task) return;
  running = true;
  idle(() => {
    try {
      task();
    } finally {
      running = false;
      pump();
    }
  });
}

/** Runs a task in a quiet moment, after the ones already waiting. */
export function later(task: Task) {
  queue.push(task);
  pump();
}

export function openGate() {
  open = true;
  pump();
}

const BLOCK = '[data-block]';

/**
 * A block marked cold is skipped by the browser while it is off screen. Every block under the
 * first screen starts cold, so the first screen is all the browser has to lay out.
 * This lets the browser render them, one in each quiet moment, until none are left.
 */
export function warm() {
  const block = document.querySelector(`${BLOCK}[data-cold]`);
  if (!block) return;
  block.removeAttribute('data-cold');
  later(warm);
}
