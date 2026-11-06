/** The browser side of the engine. Every DOM read and write the engine makes is in this file. */

import type { ChannelValues, Clock, MeasuredBox, NaturalBox, SurfacePort } from './engine.js';

const IDENTITY_EPSILON = 1e-4;

interface AncestorScale {
  scaleX: number;
  scaleY: number;
  unsupported: boolean;
}

/** Combines ancestor scale, including CSS zoom. Called on discrete events, never in the frame loop. */
function readAncestorScale(element: HTMLElement): AncestorScale {
  let scaleX = 1;
  let scaleY = 1;
  let unsupported = false;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { transform, scale, rotate, zoom } = getComputedStyle(node);
    const zoomed = Number(zoom);
    if (zoomed > 0 && zoomed !== 1) {
      scaleX *= zoomed;
      scaleY *= zoomed;
    }
    if (rotate && rotate !== 'none') unsupported = true;
    if (scale && scale !== 'none') {
      const [sx = 1, sy = sx] = scale.split(' ').map(Number);
      scaleX *= sx;
      scaleY *= sy;
    }
    if (!transform || transform === 'none') continue;
    const matrix = new DOMMatrixReadOnly(transform);
    if (!matrix.is2D || Math.abs(matrix.b) > IDENTITY_EPSILON || Math.abs(matrix.c) > IDENTITY_EPSILON) {
      unsupported = true;
      continue;
    }
    scaleX *= matrix.a;
    scaleY *= matrix.d;
  }
  // A mirrored ancestor flips the box's axes, which a size and an offset cannot describe.
  if (scaleX <= 0 || scaleY <= 0) return { scaleX: 1, scaleY: 1, unsupported: true };
  return { scaleX, scaleY, unsupported };
}

/**
 * The radius channel only runs when all four corners match, in pixels. One number cannot
 * describe a sheet with two square corners or an elliptical percentage, so those keep
 * their CSS and change in one step.
 */
function readRadius(style: CSSStyleDeclaration): number | null {
  const corners = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius];
  if (new Set(corners).size !== 1 || !(corners[0] as string).endsWith('px') || (corners[0] as string).includes(' ')) return null;
  return Number.parseFloat(corners[0] as string);
}

/** Scrolled ancestors that a short read could clamp. See "Scroll position" in the contract. */
function readScrollPositions(element: HTMLElement) {
  const positions: Array<[Element, number, number]> = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.scrollTop !== 0 || node.scrollLeft !== 0) positions.push([node, node.scrollTop, node.scrollLeft]);
  }
  return positions;
}

/** Inline properties the engine borrows during a move. The consumer's values come back after. */
const BORROWED = ['width', 'height', 'translate', 'border-radius', 'overflow', 'transition'] as const;

const CONFLICTING_TRANSITION = /(^|,\s*)(all|width|height|translate|transform|border-radius|border-[a-z-]*-radius|inline-size|block-size)(\s*,|$)/;

export function createDomPort(root: HTMLElement, content: HTMLElement): SurfacePort {
  let saved: Map<string, string> | null = null;
  let locked = false;
  let pendingScroll: Array<[Element, number, number]> = [];
  let insets = { width: 0, height: 0 };
  let skipRadius = false;

  function borrow() {
    saved ??= new Map(BORROWED.map((property) => [property, root.style.getPropertyValue(property)]));
  }

  function restoreProperty(property: string) {
    const value = saved?.get(property);
    if (value) root.style.setProperty(property, value);
    else root.style.removeProperty(property);
  }

  /** Clears geometry only. A suspended transition stays off, or the read would see it run. */
  function clearGeometry() {
    if (saved) {
      for (const property of BORROWED) if (property !== 'transition') restoreProperty(property);
    }
    content.style.removeProperty('width');
    locked = false;
  }

  function restoreScroll() {
    for (const [node, top, left] of pendingScroll) {
      if (node.scrollTop !== top) node.scrollTop = top;
      if (node.scrollLeft !== left) node.scrollLeft = left;
    }
    pendingScroll = [];
  }

  /** A CSS transition on a property the engine animates would fight it, and hide the target. */
  function suspendConflictingTransition(style: CSSStyleDeclaration) {
    if (style.transitionDuration.split(',').every((d) => Number.parseFloat(d) === 0)) return;
    if (!CONFLICTING_TRANSITION.test(style.transitionProperty)) return;
    borrow();
    root.style.setProperty('transition', 'none');
  }

  function readBox(): MeasuredBox & { rawRadius: number | null } {
    const rect = root.getBoundingClientRect();
    const { scaleX, scaleY } = readAncestorScale(root);
    const rawRadius = readRadius(getComputedStyle(root));
    return { x: rect.left / scaleX, y: rect.top / scaleY, width: rect.width / scaleX, height: rect.height / scaleY, radius: rawRadius ?? 0, rawRadius };
  }

  /** Width and height are written for this box model, so a content-box root keeps its layout. */
  function readInsets(style: CSSStyleDeclaration) {
    if (style.boxSizing !== 'content-box') return { width: 0, height: 0 };
    const sum = (...values: string[]) => values.reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
    return {
      width: sum(style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth),
      height: sum(style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth),
    };
  }

  /** Runs once per lock, so the frame loop only writes and never reads style. */
  function lock() {
    if (locked) return;
    locked = true;
    borrow();
    const style = getComputedStyle(root);
    insets = readInsets(style);
    // clip, not hidden. A hidden box is a scroll container, so focusing a field below the
    // fold would scroll the box and shift the content. clip cannot scroll. A root that is
    // already a scroller stays one, or its scroll position would reset for the move.
    if (style.overflowX === 'visible' && style.overflowY === 'visible') root.style.overflow = 'clip';
  }

  function writeSize(width: number | undefined, height: number | undefined) {
    if (width !== undefined) root.style.width = `${Math.max(width - insets.width, 0)}px`;
    if (height !== undefined) root.style.height = `${Math.max(height - insets.height, 0)}px`;
  }

  return {
    readVisible() {
      // Taken here because this runs before React changes the DOM. After the commit, a
      // shorter page may already have clamped the scroll position.
      pendingScroll = readScrollPositions(root);
      suspendConflictingTransition(getComputedStyle(root));
      const box = readBox();
      skipRadius = box.rawRadius === null;
      return box;
    },

    readNatural(): NaturalBox {
      if (pendingScroll.length === 0) pendingScroll = readScrollPositions(root);
      clearGeometry();
      const box = readBox();
      if (box.rawRadius === null) skipRadius = true;
      const contentRect = content.getBoundingClientRect();
      const { scaleX, scaleY, unsupported } = readAncestorScale(root);
      return { ...box, contentWidth: contentRect.width / scaleX, contentHeight: contentRect.height / scaleY, unsupportedTransform: unsupported };
    },

    readOrigin(width, height) {
      lock();
      writeSize(width, height);
      const box = readBox();
      return { x: box.x, y: box.y };
    },

    readRestHeight() {
      return readBox().height;
    },

    lockContentWidth(width) {
      content.style.width = `${width}px`;
    },

    write(values: Partial<ChannelValues>) {
      lock();
      const { style } = root;
      writeSize(values.width, values.height);
      if (values.dx !== undefined || values.dy !== undefined) style.translate = `${values.dx ?? 0}px ${values.dy ?? 0}px`;
      if (values.radius !== undefined && !skipRadius) style.borderRadius = `${values.radius}px`;
      if (pendingScroll.length > 0) restoreScroll();
    },

    release() {
      clearGeometry();
      restoreProperty('transition');
      saved = null;
      skipRadius = false;
      insets = { width: 0, height: 0 };
      if (pendingScroll.length > 0) restoreScroll();
    },

    setPhase(phase) {
      root.dataset['phase'] = phase;
    },

    readTiming() {
      const style = getComputedStyle(root);
      const responseMs = Number.parseFloat(style.getPropertyValue('--q-surface-response'));
      const zeta = Number.parseFloat(style.getPropertyValue('--q-surface-damping'));
      return { responseMs: Number.isNaN(responseMs) ? 320 : responseMs, zeta: Number.isNaN(zeta) ? 1 : zeta };
    },

    prefersReducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,

    isDocumentHidden: () => document.visibilityState === 'hidden',
  };
}

export const browserClock: Clock = {
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};
