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
