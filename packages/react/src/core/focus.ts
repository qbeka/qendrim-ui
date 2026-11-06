/**
 * Focus ownership. A focus target can vanish while a transition is running, so a move
 * of focus names a list of candidates in order of preference and takes the first that
 * can hold focus right now. See docs/CONTRACT.md, rule F6.
 */

export function canHoldFocus(element: HTMLElement | null | undefined): element is HTMLElement {
  if (!element || !element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled) return false;
  if (element.closest('[inert]')) return false;
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions);
  }
  return element.getClientRects().length > 0;
}

export interface FocusMove {
  target: HTMLElement | null;
  /** How many candidates were skipped. Zero means the first choice held. */
  skipped: number;
}

export function moveFocus(candidates: ReadonlyArray<HTMLElement | null | undefined>): FocusMove {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (canHoldFocus(candidate)) {
      // preventScroll: the surface is moving. Scrolling to a box in flight would land wrong.
      candidate.focus({ preventScroll: true });
      if (candidate.ownerDocument.activeElement === candidate) return { target: candidate, skipped: index };
    }
  }
  return { target: null, skipped: candidates.length };
}
