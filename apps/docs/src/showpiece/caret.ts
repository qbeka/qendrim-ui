/**
 * Finds the caret of a text field on screen. A browser does not say where a caret is, so
 * this measures the text before it: on a canvas for a one line field, and in a hidden copy
 * of the styles for a field that wraps. It measures again only when the text, the selection
 * or the width changes. Every frame in between costs one bounding box.
 */
type Field = HTMLInputElement | HTMLTextAreaElement;

interface Offset {
  key: string;
  x: number;
  y: number;
}

const MIRRORED = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;

export function createCaretReader() {
  const offsets = new WeakMap<Field, Offset>();
  let pen: CanvasRenderingContext2D | null = null;
  let mirror: HTMLDivElement | null = null;

  function measureLine(field: HTMLInputElement, position: number) {
    pen ??= document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(field);
    if (!pen) return { x: 0, y: field.clientHeight / 2 };
    pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if ('letterSpacing' in pen) (pen as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    const width = pen.measureText(field.value.slice(0, position)).width;
    return { x: (Number.parseFloat(style.paddingLeft) || 0) + width, y: field.clientHeight / 2 };
  }

  function measureWrapped(field: HTMLTextAreaElement, position: number) {
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.setAttribute('aria-hidden', 'true');
      mirror.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;pointer-events:none;contain:layout style';
      document.body.append(mirror);
    }
    const style = getComputedStyle(field);
    for (const property of MIRRORED) mirror.style[property] = style[property];
    mirror.style.width = `${field.clientWidth}px`;
    mirror.textContent = field.value.slice(0, position);
    const mark = document.createElement('span');
    mark.textContent = '​';
    mirror.append(mark);
    const line = Number.parseFloat(style.lineHeight) || mark.offsetHeight;
    return { x: mark.offsetLeft, y: mark.offsetTop + line / 2 };
  }

  return {
    /** The caret of this field in viewport pixels. `position` defaults to the end of its selection. */
    read(field: Field, position = field.selectionEnd ?? field.value.length) {
      const key = `${field.value.length}:${position}:${field.clientWidth}:${field.value}`;
      let offset = offsets.get(field);
      if (!offset || offset.key !== key) {
        const measured = field instanceof HTMLTextAreaElement ? measureWrapped(field, position) : measureLine(field, position);
        offset = { key, ...measured };
        offsets.set(field, offset);
      }
      const box = field.getBoundingClientRect();
      return {
        x: Math.min(Math.max(box.left + offset.x - field.scrollLeft, box.left), box.right),
        y: Math.min(Math.max(box.top + offset.y - field.scrollTop, box.top), box.bottom),
      };
    },
    destroy() {
      mirror?.remove();
      mirror = null;
    },
  };
}
