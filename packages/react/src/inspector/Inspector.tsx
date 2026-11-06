'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import type { TraceEvent } from '../core/engine.js';
import { moveFocus } from '../core/focus.js';
import type { IntentToken } from '../core/machine.js';
import { Surface, useIsomorphicLayoutEffect, type SurfaceHandle } from '../surface/Surface.js';

export type FocusReason = 'open' | 'reopen' | 'close' | 'recover';

export interface FocusTrace {
  type: 'focus';
  reason: FocusReason;
  /** The element that received focus, or null if nothing could. */
  target: HTMLElement | null;
  /** How many preferred owners were unavailable. */
  skipped: number;
  at: number;
}

export type InspectorTrace = TraceEvent | FocusTrace;

/** Parts that differ for a modal. Passing them in keeps Base UI Dialog out of this file. */
export interface InspectorParts {
  Trigger: ComponentType<InspectorTriggerProps & { ref?: Ref<HTMLButtonElement> }>;
  Panel: ComponentType<InspectorPanelProps & { ref?: Ref<HTMLDivElement> }>;
}

export interface InspectorContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Closes when the work succeeds, unless a newer intent arrives first. Resolves to whether it closed. */
  closeAfter: (work: Promise<unknown>) => Promise<boolean>;
  /** True while a closeAfter is waiting. */
  pending: boolean;
  triggerId: string;
  panelId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  surface: {
    handleRef: RefObject<SurfaceHandle | null>;
    rootRef: RefObject<HTMLDivElement | null>;
    onSettle: (shape: string) => void;
    onTrace: (event: TraceEvent) => void;
    fallbackFocusRef: RefObject<HTMLElement | null> | undefined;
    className: string | undefined;
  };
  invalidateClose: () => void;
  initialFocusRef: RefObject<RefObject<HTMLElement | null> | false | undefined>;
  parts: InspectorParts | undefined;
}

export const InspectorContext = createContext<InspectorContextValue | null>(null);

export function useInspector() {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('useInspector must be called inside an Inspector or ModalInspector root.');
  const { open, setOpen, closeAfter, pending } = context;
  return { open, setOpen, closeAfter, pending };
}

export function useRequiredContext() {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('Inspector parts must be rendered inside an Inspector or ModalInspector root.');
  return context;
}

export function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as RefObject<T | null>).current = value;
}

const FIRST_FIELD = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export interface InspectorCoreOptions {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Where focus goes if the trigger is gone. Falls back to the surface itself. */
  fallbackFocusRef?: RefObject<HTMLElement | null> | undefined;
  onSettle?: ((shape: string) => void) | undefined;
  onTrace?: ((event: InspectorTrace) => void) | undefined;
  className?: string | undefined;
}

interface CoreConfig {
  /** Base UI owns focus for a modal, so the nonmodal policy stands down. */
  managesFocus: boolean;
  parts: InspectorParts | undefined;
  onClosedSettle?: () => void;
}

/** State, intent and focus shared by both roots. */
export function useInspectorCore(options: InspectorCoreOptions, { managesFocus, parts, onClosedSettle }: CoreConfig) {
  const { open: openProp, defaultOpen = false, onOpenChange, fallbackFocusRef, onSettle, onTrace, className } = options;
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const [pending, setPending] = useState(false);

  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<SurfaceHandle | null>(null);
  const initialFocusRef = useRef<RefObject<HTMLElement | null> | false | undefined>(undefined);
  const lastFocused = useRef<HTMLElement | null>(null);
  const pendingToken = useRef<IntentToken | null>(null);

  const latest = useRef({ onOpenChange, onSettle, onTrace, fallbackFocusRef, onClosedSettle, controlled: openProp !== undefined });
  useIsomorphicLayoutEffect(() => {
    latest.current = { onOpenChange, onSettle, onTrace, fallbackFocusRef, onClosedSettle, controlled: openProp !== undefined };
  });

  const setOpen = useCallback((next: boolean) => {
    if (!latest.current.controlled) setUncontrolled(next);
    latest.current.onOpenChange?.(next);
  }, []);

  const traceFocus = useCallback((reason: FocusReason, candidates: Array<HTMLElement | null | undefined>) => {
    const { target, skipped } = moveFocus(candidates);
    latest.current.onTrace?.({ type: 'focus', reason, target, skipped, at: performance.now() });
  }, []);

  const closeAfter = useCallback(
    (work: Promise<unknown>) => {
      const token = handleRef.current?.token() ?? null;
      pendingToken.current = token;
      setPending(true);
      const finish = (succeeded: boolean) => {
        if (pendingToken.current === token) {
          pendingToken.current = null;
          setPending(false);
        }
        if (!succeeded || !token || !handleRef.current) return false;
        return handleRef.current.ifCurrent(token, () => setOpen(false));
      };
      return work.then(
        () => finish(true),
        () => finish(false),
      );
    },
    [setOpen],
  );

  /** Typing while a close is waiting is a newer intent, so the close no longer applies. */
  const invalidateClose = useCallback(() => {
    if (pendingToken.current) {
      handleRef.current?.invalidate();
      pendingToken.current = null;
      setPending(false);
    }
  }, []);

  // Focus policy, rules F3, F4 and F5 in docs/CONTRACT.md.
  const wasOpen = useRef(open);
  useIsomorphicLayoutEffect(() => {
    if (wasOpen.current === open || !managesFocus) return;
    wasOpen.current = open;
    const panel = panelRef.current;
    if (!panel) return;

    if (open) {
      panel.removeAttribute('inert');
      const initial = initialFocusRef.current;
      if (initial === false) return;
      const remembered = lastFocused.current;
      traceFocus(remembered ? 'reopen' : 'open', [remembered, initial?.current, panel.querySelector<HTMLElement>(FIRST_FIELD), panel]);
      return;
    }

    const active = panel.ownerDocument.activeElement;
    if (panel.contains(active) && active !== panel) lastFocused.current = active as HTMLElement;
    if (panel.contains(active)) traceFocus('close', [triggerRef.current, latest.current.fallbackFocusRef?.current, rootRef.current]);
    // Set last. Inert on the element holding focus would drop focus to <body>.
    panel.setAttribute('inert', '');
  }, [open, managesFocus, traceFocus]);

  // Rule F6, for a surface removed from the page. A layout effect cleanup runs before
  // React removes the node, so this is the last moment to see that focus was inside.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    return () => {
      if (!root?.contains(root.ownerDocument.activeElement)) return;
      queueMicrotask(() => {
        if (root.isConnected) return; // StrictMode runs this cleanup with the node still in place.
        traceFocus('recover', [latest.current.fallbackFocusRef?.current, root.ownerDocument.body]);
      });
    };
  }, [traceFocus]);

  const surfaceOnSettle = useCallback((shape: string) => {
    if (shape === 'closed') latest.current.onClosedSettle?.();
    latest.current.onSettle?.(shape);
  }, []);

  const surfaceOnTrace = useCallback((event: TraceEvent) => latest.current.onTrace?.(event), []);

  const value = useMemo<InspectorContextValue>(
    () => ({
      open,
      setOpen,
      closeAfter,
      pending,
      triggerId: `${id}-trigger`,
      panelId: `${id}-panel`,
      triggerRef,
      panelRef,
      surface: { handleRef, rootRef, onSettle: surfaceOnSettle, onTrace: surfaceOnTrace, fallbackFocusRef, className },
      invalidateClose,
      initialFocusRef,
      parts,
    }),
    [open, setOpen, closeAfter, pending, id, surfaceOnSettle, surfaceOnTrace, fallbackFocusRef, className, invalidateClose, parts],
  );

  const onFocusCapture = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (panel?.contains(event.target) && event.target !== panel) lastFocused.current = event.target as HTMLElement;
  }, []);

  return { value, onFocusCapture };
}

export interface InspectorRootProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSettle'>, InspectorCoreOptions {
  /** Below 640 CSS pixels, the panel docks to the bottom of the screen. It stays nonmodal. */
  sheet?: boolean;
  children?: ReactNode;
}

export function InspectorRoot({ open, defaultOpen, onOpenChange, sheet = false, fallbackFocusRef, onSettle, onTrace, className, children, ...rest }: InspectorRootProps) {
  const { value, onFocusCapture } = useInspectorCore({ open, defaultOpen, onOpenChange, fallbackFocusRef, onSettle, onTrace, className }, { managesFocus: true, parts: undefined });
  const { surface } = value;

  return (
    <InspectorContext.Provider value={value}>
      <div className="q-inspector-slot" data-sheet={sheet ? '' : undefined}>
        <Surface
          {...rest}
          ref={surface.rootRef}
          tabIndex={-1}
          className={['q-inspector', className].filter(Boolean).join(' ')}
          shape={value.open ? 'open' : 'closed'}
          handleRef={surface.handleRef}
          onSettle={surface.onSettle}
          onTrace={surface.onTrace}
          onFocusCapture={onFocusCapture}
        >
          {children}
        </Surface>
      </div>
    </InspectorContext.Provider>
  );
}

export interface InspectorTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const InspectorTrigger = forwardRef<HTMLButtonElement, InspectorTriggerProps>(function Trigger({ className, ...rest }, ref) {
  const { open, setOpen, triggerId, panelId, triggerRef, parts } = useRequiredContext();

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      assignRef(ref, node);
    },
    [ref, triggerRef],
  );

  if (parts) return <parts.Trigger {...rest} className={className} ref={setRef} />;

  return <button {...mergeProps<'button'>({ onClick: () => setOpen(!open) }, rest)} type="button" className={['q-inspector-trigger', className].filter(Boolean).join(' ')} ref={setRef} id={triggerId} aria-expanded={open} aria-controls={panelId} />;
});

export interface InspectorPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the panel for assistive technology. */
  label: string;
  /** The element to focus on open. Pass false to leave focus where it is. Defaults to the first field. */
  initialFocus?: RefObject<HTMLElement | null> | false;
  children?: ReactNode;
}

export const InspectorPanel = forwardRef<HTMLDivElement, InspectorPanelProps>(function Panel({ label, initialFocus, className, children, ...rest }, ref) {
  const { setOpen, panelId, panelRef, invalidateClose, initialFocusRef, parts } = useRequiredContext();

  useIsomorphicLayoutEffect(() => {
    initialFocusRef.current = initialFocus;
  }, [initialFocus, initialFocusRef]);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      assignRef(ref, node);
    },
    [panelRef, ref],
  );

  const onInputCapture = useCallback((_: FormEvent<HTMLDivElement>) => invalidateClose(), [invalidateClose]);

  if (parts) {
    return (
      <parts.Panel {...rest} label={label} initialFocus={initialFocus} className={className} ref={setRef} onInputCapture={onInputCapture}>
        {children}
      </parts.Panel>
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    event.stopPropagation();
    setOpen(false);
  };

  return (
    <div {...mergeProps<'div'>({ onKeyDown, onInputCapture }, rest)} ref={setRef} id={panelId} role="region" aria-label={label} className={['q-inspector-panel', className].filter(Boolean).join(' ')} tabIndex={-1}>
      {children}
    </div>
  );
});

export interface InspectorCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const InspectorClose = forwardRef<HTMLButtonElement, InspectorCloseProps>(function Close(props, ref) {
  const { setOpen } = useRequiredContext();
  return <button type="button" {...mergeProps<'button'>({ onClick: () => setOpen(false) }, props)} ref={ref} />;
});
