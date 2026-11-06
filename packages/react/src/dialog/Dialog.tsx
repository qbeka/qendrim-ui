'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useScopeAttributes } from '../scope/Scope.js';

export interface DialogContentProps extends Omit<ComponentPropsWithoutRef<typeof BaseDialog.Popup>, 'title'> {
  /** The visible heading. It also names the dialog for assistive technology. */
  title: ReactNode;
  description?: ReactNode;
  /** Where the popup is portaled. Defaults to <body>. */
  container?: HTMLElement | null;
}

const Content = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent({ title, description, container, className, children, ...rest }, ref) {
  const scope = useScopeAttributes();
  return (
    <BaseDialog.Portal container={container ?? undefined}>
      <BaseDialog.Backdrop className="q-dialog-backdrop" {...scope} />
      <BaseDialog.Popup {...rest} {...scope} ref={ref} className={['q-dialog', typeof className === 'string' ? className : ''].filter(Boolean).join(' ')}>
        <BaseDialog.Title className="q-dialog-title">{title}</BaseDialog.Title>
        {description ? <BaseDialog.Description className="q-dialog-description">{description}</BaseDialog.Description> : null}
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
});

export const Dialog = { Root: BaseDialog.Root, Trigger: BaseDialog.Trigger, Close: BaseDialog.Close, Content };
