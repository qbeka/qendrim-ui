'use client';

import { Toolbar } from '@base-ui/react/toolbar';
import { forwardRef, useRef, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from 'react';
import { moveFocus } from '../core/focus.js';
import { Surface, useIsomorphicLayoutEffect } from '../surface/Surface.js';

export interface ActionBarProps {
  /** Show the bar. Usually `selection.length > 0`. */
  open: boolean;
  /** Names the toolbar, such as "Receipt actions". */
  label: string;
  /** Announced politely when it changes, such as "2 selected". */
  status?: string;
  /** Where focus goes if the bar closes while it holds focus. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
}

/**
 * Contextual actions that take no layout space, so that selecting a row never moves the
 * list. The anchor is a zero-height sticky element, and the bar hangs from it. The bar
 * does not take focus when it appears, because the user is still selecting.
 */
function Root({ open, label, status, fallbackFocusRef, className, children }: ActionBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (open) {
      bar.removeAttribute('inert');
      return;
    }
    if (bar.contains(bar.ownerDocument.activeElement)) moveFocus([fallbackFocusRef?.current]);
    bar.setAttribute('inert', '');
  }, [open, fallbackFocusRef]);

  return (
    <div className="q-actionbar-anchor">
      {/* A live region must exist before its text changes, or nothing is announced. */}
      <span role="status" className="q-visually-hidden">{status}</span>
      <Surface ref={barRef} shape={open ? 'open' : 'closed'} className={['q-actionbar', className].filter(Boolean).join(' ')}>
        <Toolbar.Root aria-label={label} className="q-actionbar-toolbar">
          {status ? <span className="q-actionbar-status" aria-hidden>{status}</span> : null}
          {children}
        </Toolbar.Root>
      </Surface>
    </div>
  );
}

const Action = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Toolbar.Button>>(function ActionBarAction({ className, ...rest }, ref) {
  return <Toolbar.Button {...rest} ref={ref} className={['q-actionbar-action', typeof className === 'string' ? className : ''].filter(Boolean).join(' ')} />;
});

export const ActionBar = { Root, Action };
