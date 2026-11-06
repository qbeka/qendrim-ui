import { useRef } from 'react';
import type { ImplProps } from '../types';
import { useGuardedDeferredClose, usePlainFocus } from './shared';

/**
 * Baseline: CSS only. A grid track transitions between 0fr and 1fr. Browsers reverse a
 * running CSS transition from its current value, so this retargets with no JavaScript.
 * It does not carry velocity through a reversal.
 */
export function NativeGridImpl({ open, setOpen, onRendered, body, deferCloseRef }: ImplProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePlainFocus(open, triggerRef, panelRef);
  useGuardedDeferredClose(setOpen, open, deferCloseRef);
  return (
    <div className="fx-box fx-plain" data-probe="box">
      <button ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</button>
      <div className="fx-native" data-open={open || undefined} onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') onRendered(open ? 'open' : 'closed'); }}>
        <div ref={panelRef}>{body}</div>
      </div>
    </div>
  );
}
