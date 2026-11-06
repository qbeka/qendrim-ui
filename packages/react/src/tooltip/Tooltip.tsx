'use client';

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { useScopeAttributes } from '../scope/Scope.js';

export interface TooltipProps extends Omit<ComponentPropsWithoutRef<typeof BaseTooltip.Root>, 'children'> {
  /** The text to show. A tooltip adds a hint. It must not be the only name of a control. */
  content: ReactNode;
  /** One focusable element. */
  children: ReactElement;
  side?: ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>['side'];
  /** Milliseconds before it opens on hover. */
  delay?: number;
}

export function Tooltip({ content, children, side, delay = 400, ...rest }: TooltipProps) {
  const scope = useScopeAttributes();
  return (
    <BaseTooltip.Root {...rest}>
      <BaseTooltip.Trigger delay={delay} render={children as ReactElement<Record<string, unknown>>} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner className="q-popup-positioner q-tooltip-positioner" side={side} sideOffset={6} {...scope}>
          <BaseTooltip.Popup className="q-tooltip">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
