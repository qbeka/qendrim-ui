'use client';

import { Popover as BasePopover } from '@base-ui/react/popover';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useScopeAttributes } from '../scope/Scope.js';

export interface PopoverContentProps extends Omit<ComponentPropsWithoutRef<typeof BasePopover.Popup>, 'title'> {
  /** Names the popover. Rendered as its visible heading. */
  title?: ReactNode;
  side?: ComponentPropsWithoutRef<typeof BasePopover.Positioner>['side'];
  align?: ComponentPropsWithoutRef<typeof BasePopover.Positioner>['align'];
  /** Where the popup is portaled. Defaults to <body>. */
  container?: HTMLElement | null;
}

const Content = forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent({ title, side, align, container, className, children, ...rest }, ref) {
  const scope = useScopeAttributes();
  return (
    <BasePopover.Portal container={container ?? undefined}>
      <BasePopover.Positioner className="q-popup-positioner" side={side} align={align} sideOffset={6} collisionPadding={8} {...scope}>
        <BasePopover.Popup {...rest} ref={ref} className={['q-popup', 'q-popover', typeof className === 'string' ? className : ''].filter(Boolean).join(' ')}>
          {title ? <BasePopover.Title className="q-popup-title">{title}</BasePopover.Title> : null}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
});

export const Popover = { Root: BasePopover.Root, Trigger: BasePopover.Trigger, Close: BasePopover.Close, Content };
