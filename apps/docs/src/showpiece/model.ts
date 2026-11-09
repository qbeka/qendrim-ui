/**
 * What the showpiece can be asked for, with no DOM in it. The page keeps the layout and the
 * spring in the address, so a link restores what a visitor set up. Text never goes there.
 */
import { sampleSpring, springFromResponse } from '../../../../packages/react/src/core/spring';

export const LAYOUTS = [
  { id: 'row', label: 'Row' },
  { id: 'card', label: 'Card' },
  { id: 'editor', label: 'Editor' },
  { id: 'sheet', label: 'Sheet' },
] as const;

export type Layout = (typeof LAYOUTS)[number]['id'];

export interface SpringSetting {
  /** Undamped period in milliseconds, which is what --q-surface-response takes. */
  response: number;
  /** Damping ratio, which is what --q-surface-damping takes. 1 does not overshoot. */
  damping: number;
}

export const RESPONSE = { min: 160, max: 800, step: 10 } as const;
export const DAMPING = { min: 0.3, max: 1, step: 0.01 } as const;
export const RATE = { min: 2, max: 60, step: 1 } as const;

export const PRESETS = [
  { id: 'firm', label: 'Firm', spring: { response: 320, damping: 1 } },
  { id: 'springy', label: 'Springy', spring: { response: 400, damping: 0.72 } },
  { id: 'loose', label: 'Loose', spring: { response: 560, damping: 0.46 } },
] as const satisfies ReadonlyArray<{ id: string; label: string; spring: SpringSetting }>;

export interface ShowState {
  layout: Layout;
  spring: SpringSetting;
  rate: number;
}

export const DEFAULT_STATE: ShowState = { layout: 'card', spring: PRESETS[1].spring, rate: 24 };

const isLayout = (value: string | null): value is Layout => LAYOUTS.some((layout) => layout.id === value);

function clampTo(value: number, { min, max, step }: { min: number; max: number; step: number }) {
  const snapped = Math.round((Math.min(Math.max(value, min), max) - min) / step) * step + min;
  return Number(snapped.toFixed(2));
}

function readNumber(params: URLSearchParams, key: string, range: { min: number; max: number; step: number }, fallback: number) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clampTo(value, range) : fallback;
}

/** Reads a query string. Anything missing or malformed falls back to the default. */
export function parseState(search: string): ShowState {
  const params = new URLSearchParams(search);
  const layout = params.get('layout');
  return {
    layout: isLayout(layout) ? layout : DEFAULT_STATE.layout,
    spring: {
      response: readNumber(params, 'response', RESPONSE, DEFAULT_STATE.spring.response),
      damping: readNumber(params, 'damping', DAMPING, DEFAULT_STATE.spring.damping),
    },
    rate: readNumber(params, 'rate', RATE, DEFAULT_STATE.rate),
  };
}

/** Writes only what differs from the default, so an untouched page keeps a clean address. */
export function serializeState(state: ShowState, search = ''): string {
  const params = new URLSearchParams(search);
  const put = (key: string, value: string, standard: string) => {
    if (value === standard) params.delete(key);
    else params.set(key, value);
  };
  put('layout', state.layout, DEFAULT_STATE.layout);
  put('response', String(state.spring.response), String(DEFAULT_STATE.spring.response));
  put('damping', String(state.spring.damping), String(DEFAULT_STATE.spring.damping));
  put('rate', String(state.rate), String(DEFAULT_STATE.rate));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** The layout after this one, going round. The idle loop uses it. */
export function nextLayout(layout: Layout, step = 1): Layout {
  const index = LAYOUTS.findIndex((item) => item.id === layout);
  const count = LAYOUTS.length;
  return (LAYOUTS[(((index + step) % count) + count) % count] as (typeof LAYOUTS)[number]).id;
}

/**
 * Any layout but this one, chosen by a number from 0 up to 1. The stress control uses it,
 * so the panel wanders instead of circling one spot.
 */
export function otherLayout(layout: Layout, pick: number): Layout {
  const others = LAYOUTS.filter((item) => item.id !== layout);
  return (others[Math.min(Math.floor(pick * others.length), others.length - 1)] as (typeof LAYOUTS)[number]).id;
}

/** One size up or down, stopping at the ends. Escape and Enter in a field use it. */
export function stepLayout(layout: Layout, step: 1 | -1): Layout {
  const index = LAYOUTS.findIndex((item) => item.id === layout);
  return (LAYOUTS[Math.min(Math.max(index + step, 0), LAYOUTS.length - 1)] as (typeof LAYOUTS)[number]).id;
}

export const CURVE = { width: 252, height: 84, seconds: 1.2, samples: 72, top: 1.5 } as const;

/**
 * The step response of the spring, as an SVG path. It samples the library's own closed form,
 * so the drawing and the moving panel cannot disagree.
 */
export function curvePath({ response, damping }: SpringSetting): string {
  const spring = springFromResponse(response, damping);
  let d = '';
  for (let i = 0; i <= CURVE.samples; i += 1) {
    const t = (i / CURVE.samples) * CURVE.seconds;
    const { value } = sampleSpring({ from: 0, velocity: 0, to: 1 }, spring, t);
    const x = (i / CURVE.samples) * CURVE.width;
    const y = CURVE.height - (Math.min(Math.max(value, 0), CURVE.top) / CURVE.top) * CURVE.height;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** How far past the target the spring goes, as a share of the distance. 0 when it does not. */
export function overshoot(damping: number): number {
  if (damping >= 1) return 0;
  return Math.exp((-damping * Math.PI) / Math.sqrt(1 - damping * damping));
}

/** The two lines a visitor pastes into their own CSS. */
export function springCss({ response, damping }: SpringSetting, selector = '.panel'): string {
  return `${selector} {\n  --q-surface-response: ${response};\n  --q-surface-damping: ${damping};\n}`;
}
