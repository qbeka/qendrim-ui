import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import type { ImplProps } from '../types';
import { SPRING, useGuardedDeferredClose, usePlainFocus, useRemovalFocus } from './shared';

/**
 * Baseline: Motion animating height to 'auto'. This is the common way to write it, and it
 * is a good one: real height, a spring that retargets, and no scale on the content.
 */
export function MotionHeightImpl({ open, setOpen, onRendered, body, deferCloseRef, fallbackFocusRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  usePlainFocus(open, triggerRef, panelRef);
  useRemovalFocus(boxRef, fallbackFocusRef);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  return (
    <div ref={boxRef} className="fx-box fx-plain" data-probe="box">
      <button ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</button>
      <motion.div ref={panelRef} initial={false} animate={{ height: open ? 'auto' : 0 }} transition={SPRING} style={{ overflow: 'hidden' }} onAnimationComplete={() => onRendered(open ? 'open' : 'closed')}>
        {body}
      </motion.div>
    </div>
  );
}

/**
 * Baseline: Motion with a numeric height measured by ResizeObserver. About 30 more lines
 * than the version above, and it also animates content growth at rest. It is what a careful
 * engineer writes once the auto version falls short. An independent reviewer wrote the
 * first version of this to test whether the library's lead on that scenario was real.
 */
export function MotionMeasuredImpl({ open, setOpen, onRendered, body, deferCloseRef, fallbackFocusRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | string>(open ? 'auto' : 0);
  const openRef = useRef(open);
  const go = (to: number) => animate(height, to, { ...SPRING, onComplete: () => onRendered(openRef.current ? 'open' : 'closed') });
  usePlainFocus(open, triggerRef, panelRef);
  useRemovalFocus(boxRef, fallbackFocusRef);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  useLayoutEffect(() => {
    const inner = innerRef.current as HTMLDivElement;
    if (openRef.current) height.set(inner.offsetHeight);
    const observer = new ResizeObserver(() => {
      if (openRef.current) go(inner.offsetHeight);
    });
    observer.observe(inner);
    return () => observer.disconnect();
    // The observer lives as long as the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (openRef.current === open) return;
    openRef.current = open;
    go(open ? (innerRef.current as HTMLDivElement).offsetHeight : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div ref={boxRef} className="fx-box fx-plain" data-probe="box">
      <button ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</button>
      <motion.div ref={panelRef} style={{ height, overflow: 'hidden' }}>
        <div ref={innerRef} style={{ display: 'flow-root' }}>{body}</div>
      </motion.div>
    </div>
  );
}

/**
 * Baseline: Motion's layout animation with a conditional panel. Layout uses scale, and the
 * docs describe the correction for it. The field's value is lifted to the page so that this
 * baseline does not lose it for an unrelated reason.
 */
export function MotionLayoutImpl({ open, setOpen, onRendered, body, deferCloseRef, fallbackFocusRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  usePlainFocus(open, triggerRef, panelRef);
  useRemovalFocus(boxRef, fallbackFocusRef);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  return (
    <motion.div ref={boxRef} layout transition={SPRING} className="fx-box fx-plain" data-probe="box" style={{ overflow: 'hidden', borderRadius: 8 }} onLayoutAnimationComplete={() => onRendered(open ? 'open' : 'closed')}>
      <motion.button layout="position" ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</motion.button>
      <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => onRendered('closed')}>
        {open ? (
          <motion.div key="panel" ref={panelRef} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            {body}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
