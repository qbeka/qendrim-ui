import type { ReactNode, RefObject } from 'react';

export type Requested = 'open' | 'closed';

/** Every implementation under test renders these probes and reports these events. */
export interface ImplProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onRendered: (state: Requested) => void;
  onTrace: (event: unknown) => void;
  body: ReactNode;
  /** Closes after `ms`, unless the implementation's own rule cancels it. */
  deferCloseRef: RefObject<((ms: number) => void) | null>;
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

export interface Sample {
  t: number;
  height: number;
  width: number;
  x: number;
  y: number;
  requested: Requested;
  rendered: Requested;
  focus: string;
  inputScaleX: number;
  inputScaleY: number;
  interactive: number;
  inputVisible: boolean;
  value: string;
  /** The rect of the same input relative to the box, for catching content shifts. */
  inputTop: number;
}

export interface HarnessEvent {
  t: number;
  type: string;
  detail?: unknown;
}

export interface Trace {
  samples: Sample[];
  events: HarnessEvent[];
}
