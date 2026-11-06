/**
 * Resource counters for the leak checks. These wrap browser APIs on the fixture page only.
 * "Active" means started and not yet stopped. A count cannot prove the absence of a leak.
 * It shows whether these specific resources returned to their starting level.
 */

export interface Counters {
  observers: number;
  intervals: number;
  timeouts: number;
  rafCalls: number;
  listeners: number;
}

export const counters: Counters = { observers: 0, intervals: 0, timeouts: 0, rafCalls: 0, listeners: 0 };

let installed = false;

export function installCounters() {
  if (installed) return;
  installed = true;

  const NativeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends NativeObserver {
    private active = false;
    override observe(target: Element, options?: ResizeObserverOptions) {
      if (!this.active) counters.observers += 1;
      this.active = true;
      super.observe(target, options);
    }
    override disconnect() {
      if (this.active) counters.observers -= 1;
      this.active = false;
      super.disconnect();
    }
  };

  const nativeRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    counters.rafCalls += 1;
    return nativeRaf(callback);
  };

  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const liveIntervals = new Set<number>();
  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = nativeSetInterval(handler, timeout, ...args);
    liveIntervals.add(id);
    counters.intervals = liveIntervals.size;
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = (id?: number) => {
    if (id !== undefined) liveIntervals.delete(id);
    counters.intervals = liveIntervals.size;
    nativeClearInterval(id);
  };

  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  const seen = new Set<EventListenerOrEventListenerObject>();
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
    if (type === 'resize' && !seen.has(listener)) {
      seen.add(listener);
      counters.listeners = seen.size;
    }
    nativeAdd(type, listener, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions) => {
    if (type === 'resize') {
      seen.delete(listener);
      counters.listeners = seen.size;
    }
    nativeRemove(type, listener, options);
  }) as typeof window.removeEventListener;
}
