/** The browser side of the engine. Every DOM read and write the engine makes is in this file. */

import type { Clock, MeasuredBox, NaturalBox, SurfacePort } from './engine.js';

const IDENTITY_EPSILON = 1e-4;

interface AncestorScale {
  scaleX: number;
  scaleY: number;
  unsupported: boolean;
}

/** Combines ancestor transforms. Called on discrete events only, never in the frame loop. */
function readAncestorScale(element: HTMLElement): AncestorScale {
  let scaleX = 1;
  let scaleY = 1;
  let unsupported = false;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { transform, scale, rotate } = getComputedStyle(node);
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
  return { scaleX: scaleX || 1, scaleY: scaleY || 1, unsupported };
}

function readRadius(style: CSSStyleDeclaration, width: number): number {
  const value = style.borderTopLeftRadius.split(' ')[0] ?? '0';
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return value.endsWith('%') ? (parsed / 100) * width : parsed;
}

/** Scrolled ancestors that a short read could clamp. See "Scroll position" in the contract. */
function readScrollPositions(element: HTMLElement) {
  const positions: Array<[Element, number, number]> = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.scrollTop !== 0 || node.scrollLeft !== 0) positions.push([node, node.scrollTop, node.scrollLeft]);
  }
  return positions;
}

export function createDomPort(root: HTMLElement, content: HTMLElement): SurfacePort {
  let locked = false;
  let pendingScroll: Array<[Element, number, number]> = [];

  function clearInline() {
    const { style } = root;
    style.removeProperty('width');
    style.removeProperty('height');
    style.removeProperty('translate');
    style.removeProperty('border-radius');
    style.removeProperty('overflow');
    style.removeProperty('box-sizing');
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

  return {
    readVisible(): MeasuredBox {
      // Taken here because this runs before React changes the DOM. After the commit, a
      // shorter page may already have clamped the scroll position.
      pendingScroll = readScrollPositions(root);
      const rect = root.getBoundingClientRect();
      const { scaleX, scaleY } = readAncestorScale(root);
      const width = rect.width / scaleX;
      return {
        x: rect.left / scaleX,
        y: rect.top / scaleY,
        width,
        height: rect.height / scaleY,
        radius: readRadius(getComputedStyle(root), width),
      };
    },

    readNatural(): NaturalBox {
      if (pendingScroll.length === 0) pendingScroll = readScrollPositions(root);
      clearInline();
      const rect = root.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const { scaleX, scaleY, unsupported } = readAncestorScale(root);
      const width = rect.width / scaleX;
      return {
        x: rect.left / scaleX,
        y: rect.top / scaleY,
        width,
        height: rect.height / scaleY,
        radius: readRadius(getComputedStyle(root), width),
        contentWidth: contentRect.width / scaleX,
        contentHeight: contentRect.height / scaleY,
        unsupportedTransform: unsupported,
      };
    },

    lockContentWidth(width) {
      content.style.width = `${width}px`;
    },

    write(values) {
      const { style } = root;
      if (!locked) {
        locked = true;
        style.boxSizing = 'border-box';
        // clip, not hidden. A hidden box is a scroll container, so focusing a field below
        // the fold would scroll the box and shift the content. clip cannot scroll.
        style.overflow = 'clip';
      }
      if (values.width !== undefined) style.width = `${values.width}px`;
      if (values.height !== undefined) style.height = `${values.height}px`;
      if (values.dx !== undefined || values.dy !== undefined) style.translate = `${values.dx ?? 0}px ${values.dy ?? 0}px`;
      if (values.radius !== undefined) style.borderRadius = `${values.radius}px`;
      if (pendingScroll.length > 0) restoreScroll();
    },

    release() {
      clearInline();
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
