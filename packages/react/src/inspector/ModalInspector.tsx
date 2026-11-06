'use client';

import { Dialog } from '@base-ui/react/dialog';
import { forwardRef, useCallback, useRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { canHoldFocus } from '../core/focus.js';
import { useScopeAttributes } from '../scope/Scope.js';
import { Surface } from '../surface/Surface.js';
import { assignRef, InspectorContext, useInspectorCore, useRequiredContext, type InspectorCoreOptions, type InspectorPanelProps, type InspectorParts, type InspectorTriggerProps } from './Inspector.js';

const ModalTrigger = forwardRef<HTMLButtonElement, InspectorTriggerProps>(function Trigger({ className, ...rest }, ref) {
  return <Dialog.Trigger {...rest} ref={ref} type="button" className={['q-inspector-trigger', className].filter(Boolean).join(' ')} />;
});

const ModalPanel = forwardRef<HTMLDivElement, InspectorPanelProps>(function Panel({ label, initialFocus, className, children, ...rest }, ref) {
  const { open, panelId, surface, triggerRef } = useRequiredContext();
  const scope = useScopeAttributes();

  // Keeps one identity across renders. Base UI stores the popup element in state, and a new
  // callback here would hand it null and then the node again on every render.
  const popupRef = useRef<Ref<HTMLDivElement> | undefined>(undefined);
  const setPopup = useCallback(
    (node: HTMLDivElement | null) => {
      surface.rootRef.current = node;
      assignRef(popupRef.current, node);
    },
    [surface.rootRef],
  );

  // Keeps the closed shape on top of the trigger, wherever the trigger is now.
  const refreshOrigin = useCallback(() => {
    const root = surface.rootRef.current;
    const trigger = triggerRef.current;
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
  }, [surface.rootRef, triggerRef]);

  return (
    <Dialog.Portal keepMounted>
      <Dialog.Backdrop className="q-inspector-backdrop" {...scope} />
      <Dialog.Popup
        aria-label={label}
        initialFocus={initialFocus === false ? false : initialFocus}
        finalFocus={() => {
          if (canHoldFocus(triggerRef.current)) return true;
          return surface.fallbackFocusRef?.current ?? true;
        }}
        render={(props) => {
          // keepMounted hides the popup with the `hidden` attribute, which has no box to
          // read. The closed shape uses `visibility` instead, so it stays measurable.
          const { hidden: _hidden, ...popup } = props as typeof props & { hidden?: boolean };
          popupRef.current = (popup as { ref?: Ref<HTMLDivElement> }).ref;
          return (
            <Surface
              {...popup}
              ref={setPopup}
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
        <div {...rest} ref={ref} id={panelId} className={['q-inspector-panel', className].filter(Boolean).join(' ')}>
          {children}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
});

const PARTS: InspectorParts = { Trigger: ModalTrigger, Panel: ModalPanel };

export interface ModalInspectorRootProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSettle'>, InspectorCoreOptions {
  children?: ReactNode;
}

/**
 * An Inspector under the dialog contract: focus is trapped, the page behind is inert and
 * scroll is locked. Base UI Dialog supplies all of that. Surface supplies the geometry.
 * This is a separate root so that the nonmodal Inspector does not pay for Dialog, and so
 * that modal is always a choice in code. Layout can never turn it on.
 */
export function ModalInspectorRoot({ open, defaultOpen, onOpenChange, fallbackFocusRef, onSettle, onTrace, className, children, ...rest }: ModalInspectorRootProps) {
  const actionsRef = useRef<Dialog.Root.Actions | null>(null);
  const { value } = useInspectorCore(
    { open, defaultOpen, onOpenChange, fallbackFocusRef, onSettle, onTrace, className },
    // Base UI waits for the unmount action, so the popup stays until the move has finished.
    { managesFocus: false, parts: PARTS, onClosedSettle: () => actionsRef.current?.unmount() },
  );

  return (
    <InspectorContext.Provider value={value}>
      <Dialog.Root open={value.open} onOpenChange={(next) => value.setOpen(next)} modal actionsRef={actionsRef}>
        <div {...rest} className="q-inspector-slot">
          {children}
        </div>
      </Dialog.Root>
    </InspectorContext.Provider>
  );
}
