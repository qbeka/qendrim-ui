import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { ImplProps } from '../types';

/**
 * The focus rule and the deferred-close guard, written the plain way. Baselines get these
 * so that the comparison is about geometry. Leaving them out would rig it.
 */
export function usePlainFocus(open: boolean, triggerRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLElement | null>) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const panel = panelRef.current;
    if (open) {
      panel?.removeAttribute('inert');
      panel?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    } else {
      if (panel?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
      panel?.setAttribute('inert', '');
    }
  }, [open, panelRef, triggerRef]);
}

/**
 * The same spring equation as Surface: a period of 320 ms and critical damping. These
 * numbers are the angular frequency squared and twice the frequency.
 */
export const SPRING = { type: 'spring', stiffness: 385.5, damping: 39.27, mass: 1 } as const;

/** The plain removal rule: if focus is inside when the box goes, send it to the fallback. */
export function useRemovalFocus(boxRef: RefObject<HTMLElement | null>, fallbackFocusRef: ImplProps['fallbackFocusRef']) {
  useLayoutEffect(() => {
    const box = boxRef.current;
    return () => {
      if (box?.contains(document.activeElement)) queueMicrotask(() => fallbackFocusRef.current?.focus());
    };
  }, [boxRef, fallbackFocusRef]);
}

export function useGuardedDeferredClose(setOpen: (open: boolean) => void, open: boolean, deferCloseRef: ImplProps['deferCloseRef']) {
  const latest = useRef(0);
  const wasOpen = useRef(open);
  if (wasOpen.current !== open) {
    wasOpen.current = open;
    latest.current += 1;
  }
  useEffect(() => {
    deferCloseRef.current = (ms) => {
      const token = latest.current;
      setTimeout(() => {
        if (token === latest.current) setOpen(false);
      }, ms);
    };
    return () => {
      deferCloseRef.current = null;
    };
  }, [deferCloseRef, setOpen]);
}
