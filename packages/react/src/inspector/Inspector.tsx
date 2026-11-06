'use client';

import { Dialog } from '@base-ui/react/dialog';
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
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { TraceEvent } from '../core/engine.js';
import { canHoldFocus, moveFocus } from '../core/focus.js';
import type { IntentToken } from '../core/machine.js';
import { useScopeAttributes } from '../scope/Scope.js';
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

interface InspectorContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Closes when the work succeeds, unless a newer intent arrives first. Resolves to whether it closed. */
  closeAfter: (work: Promise<unknown>) => Promise<boolean>;
  /** True while a closeAfter is waiting. */
  pending: boolean;
  modal: boolean;
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
    dialogActionsRef: RefObject<Dialog.Root.Actions | null>;
  };
  invalidateClose: () => void;
  initialFocusRef: RefObject<RefObject<HTMLElement | null> | false | undefined>;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function useInspector() {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('useInspector must be called inside Inspector.Root.');
  const { open, setOpen, closeAfter, pending } = context;
  return { open, setOpen, closeAfter, pending };
}

function useRequiredContext() {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('Inspector parts must be rendered inside Inspector.Root.');
  return context;
}

const FIRST_FIELD = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export interface InspectorRootProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSettle'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Use the dialog contract: focus is trapped, the page behind is inert and scroll is
   * locked. Layout never changes this. A panel at the bottom of a phone stays nonmodal
   * unless you ask for modal.
   */
  modal?: boolean;
  /** Below 640 CSS pixels, a nonmodal panel docks to the bottom of the screen. */
  sheet?: boolean;
  /** Where focus goes if the trigger is gone. Falls back to the surface itself. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onSettle?: (shape: string) => void;
  onTrace?: (event: InspectorTrace) => void;
  children?: ReactNode;
}

function Root({ open: openProp, defaultOpen = false, onOpenChange, modal = false, sheet = false, fallbackFocusRef, onSettle, onTrace, className, children, ...rest }: InspectorRootProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const [pending, setPending] = useState(false);

  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<SurfaceHandle | null>(null);
  const dialogActionsRef = useRef<Dialog.Root.Actions | null>(null);
  const initialFocusRef = useRef<RefObject<HTMLElement | null> | false | undefined>(undefined);
  const lastFocused = useRef<HTMLElement | null>(null);
  const pendingToken = useRef<IntentToken | null>(null);

  const latest = useRef({ onOpenChange, onSettle, onTrace, fallbackFocusRef, controlled: openProp !== undefined });
  useIsomorphicLayoutEffect(() => {
    latest.current = { onOpenChange, onSettle, onTrace, fallbackFocusRef, controlled: openProp !== undefined };
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

  // Nonmodal focus policy, rules F3, F4 and F5. Base UI owns this for a modal.
  const wasOpen = useRef(open);
  useIsomorphicLayoutEffect(() => {
    if (wasOpen.current === open || modal) return;
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
  }, [open, modal, traceFocus]);

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
    if (shape === 'closed') dialogActionsRef.current?.unmount();
    latest.current.onSettle?.(shape);
  }, []);

  const surfaceOnTrace = useCallback((event: TraceEvent) => latest.current.onTrace?.(event), []);

  const value = useMemo<InspectorContextValue>(
    () => ({
      open,
      setOpen,
      closeAfter,
      pending,
      modal,
      triggerId: `${id}-trigger`,
      panelId: `${id}-panel`,
      triggerRef,
      panelRef,
      surface: { handleRef, rootRef, onSettle: surfaceOnSettle, onTrace: surfaceOnTrace, fallbackFocusRef, className, dialogActionsRef },
      invalidateClose,
      initialFocusRef,
    }),
    [open, setOpen, closeAfter, pending, modal, id, surfaceOnSettle, surfaceOnTrace, fallbackFocusRef, className, invalidateClose],
  );

  const onFocusCapture = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (panel?.contains(event.target) && event.target !== panel) lastFocused.current = event.target as HTMLElement;
  }, []);

  if (modal) {
    return (
      <InspectorContext.Provider value={value}>
        <Dialog.Root open={open} onOpenChange={(next) => setOpen(next)} modal actionsRef={dialogActionsRef}>
          <div {...rest} className="q-inspector-slot">
            {children}
          </div>
        </Dialog.Root>
      </InspectorContext.Provider>
    );
  }

  return (
    <InspectorContext.Provider value={value}>
      <div className="q-inspector-slot" data-sheet={sheet ? '' : undefined}>
        <Surface
          {...rest}
          ref={rootRef}
          tabIndex={-1}
          className={['q-inspector', className].filter(Boolean).join(' ')}
          shape={open ? 'open' : 'closed'}
          handleRef={handleRef}
          onSettle={surfaceOnSettle}
          onTrace={surfaceOnTrace}
          onFocusCapture={onFocusCapture}
        >
          {children}
        </Surface>
      </div>
    </InspectorContext.Provider>
  );
}

export interface InspectorTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

const Trigger = forwardRef<HTMLButtonElement, InspectorTriggerProps>(function Trigger({ className, ...rest }, ref) {
  const { open, setOpen, modal, triggerId, panelId, triggerRef } = useRequiredContext();

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref, triggerRef],
  );

  const shared = { type: 'button' as const, className: ['q-inspector-trigger', className].filter(Boolean).join(' ') };

  if (modal) {
    return <Dialog.Trigger {...rest} {...shared} ref={setRef} />;
  }

  return <button {...mergeProps<'button'>({ onClick: () => setOpen(!open) }, rest)} {...shared} ref={setRef} id={triggerId} aria-expanded={open} aria-controls={panelId} />;
});

export interface InspectorPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the panel for assistive technology. */
  label: string;
  /** The element to focus on open. Pass false to leave focus where it is. Defaults to the first field. */
  initialFocus?: RefObject<HTMLElement | null> | false;
  children?: ReactNode;
}

const Panel = forwardRef<HTMLDivElement, InspectorPanelProps>(function Panel({ label, initialFocus, className, children, ...rest }, ref) {
  const context = useRequiredContext();
  const { open, setOpen, modal, triggerId, panelId, panelRef, invalidateClose, initialFocusRef, surface } = context;
  const scope = useScopeAttributes();

  useIsomorphicLayoutEffect(() => {
    initialFocusRef.current = initialFocus;
  }, [initialFocus, initialFocusRef]);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [panelRef, ref],
  );

  const onInputCapture = useCallback((_: FormEvent<HTMLDivElement>) => invalidateClose(), [invalidateClose]);

  const classes = ['q-inspector-panel', className].filter(Boolean).join(' ');

  // Keeps a modal's closed shape on top of its trigger, wherever the trigger is now.
  const refreshOrigin = useCallback(() => {
    const root = surface.rootRef.current;
    const trigger = context.triggerRef.current;
    if (!root) return;
    if (!trigger?.isConnected) {
      root.dataset['origin'] = 'lost';
      return;
    }
    const rect = trigger.getBoundingClientRect();
    delete root.dataset['origin'];
    root.style.setProperty('--q-origin-x', `${rect.left}px`);
    root.style.setProperty('--q-origin-y', `${rect.top}px`);
    root.style.setProperty('--q-origin-width', `${rect.width}px`);
    root.style.setProperty('--q-origin-height', `${rect.height}px`);
  }, [context.triggerRef, surface.rootRef]);

  if (modal) {
    return (
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="q-inspector-backdrop" {...scope} />
        <Dialog.Popup
          aria-label={label}
          initialFocus={initialFocus === false ? false : initialFocus}
          finalFocus={() => {
            const trigger = context.triggerRef.current;
            if (canHoldFocus(trigger)) return true;
            return surface.fallbackFocusRef?.current ?? true;
          }}
          render={(props) => {
            // keepMounted hides the popup with the `hidden` attribute, which has no box to
            // read. The closed shape uses `visibility` instead, so it stays measurable.
            const { hidden: _hidden, ...popup } = props as typeof props & { hidden?: boolean };
            return (
              <Surface
                {...popup}
                ref={(node) => {
                  surface.rootRef.current = node;
                  const forwarded = (popup as { ref?: React.Ref<HTMLDivElement> }).ref;
                  if (typeof forwarded === 'function') forwarded(node);
                  else if (forwarded) (forwarded as React.RefObject<HTMLDivElement | null>).current = node;
                }}
                className={['q-inspector', 'q-inspector--modal', surface.className].filter(Boolean).join(' ')}
                shape={open ? 'open' : 'closed'}
                handleRef={surface.handleRef}
                onSettle={surface.onSettle}
                onTrace={surface.onTrace}
                beforeCapture={refreshOrigin}
                {...scope}
              />
            );
          }}
        >
          <div {...rest} ref={setRef} id={panelId} className={classes} onInputCapture={onInputCapture}>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    event.stopPropagation();
    setOpen(false);
  };

  return (
    <div
      {...mergeProps<'div'>({ onKeyDown, onInputCapture }, rest)}
      ref={setRef}
      id={panelId}
      role="region"
      aria-label={label}
      aria-labelledby={label ? undefined : triggerId}
      className={classes}
      tabIndex={-1}
    >
      {children}
    </div>
  );
});

export interface InspectorCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

const Close = forwardRef<HTMLButtonElement, InspectorCloseProps>(function Close(props, ref) {
  const { setOpen } = useRequiredContext();
  return <button type="button" {...mergeProps<'button'>({ onClick: () => setOpen(false) }, props)} ref={ref} />;
});

export const Inspector = { Root, Trigger, Panel, Close };
