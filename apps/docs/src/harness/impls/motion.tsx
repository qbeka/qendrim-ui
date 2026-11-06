import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import type { ImplProps } from '../types';
import { useGuardedDeferredClose, usePlainFocus } from './shared';

const SPRING = { type: 'spring', visualDuration: 0.32, bounce: 0 } as const;

/**
 * Baseline: Motion animating height to 'auto'. This is the common way to write it, and it
 * is a good one: real height, a spring that retargets, and no scale on the content.
 */
export function MotionHeightImpl({ open, setOpen, onRendered, body, deferCloseRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePlainFocus(open, triggerRef, panelRef);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  return (
    <div className="fx-box fx-plain" data-probe="box">
      <button ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</button>
      <motion.div ref={panelRef} initial={false} animate={{ height: open ? 'auto' : 0 }} transition={SPRING} style={{ overflow: 'hidden' }} onAnimationComplete={() => onRendered(open ? 'open' : 'closed')}>
        {body}
      </motion.div>
    </div>
  );
}

/**
 * Baseline: Motion's layout animation with a conditional panel. Layout uses scale, and the
 * docs describe the correction for it. The field's value is lifted to the page so that this
 * baseline does not lose it for an unrelated reason.
 */
export function MotionLayoutImpl({ open, setOpen, onRendered, body, deferCloseRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  return (
    <motion.div layout transition={SPRING} className="fx-box fx-plain" data-probe="box" style={{ overflow: 'hidden', borderRadius: 8 }} onLayoutAnimationComplete={() => onRendered(open ? 'open' : 'closed')}>
      <motion.button layout="position" ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</motion.button>
      <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => triggerRef.current?.isConnected && !open && undefined}>
        {open ? (
          <motion.div key="panel" ref={panelRef} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} onAnimationStart={() => panelRef.current?.querySelector('input')?.focus({ preventScroll: true })}>
            {body}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
