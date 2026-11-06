'use client';

import { Button as BaseButton } from '@base-ui/react/button';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export interface ButtonProps extends ComponentPropsWithoutRef<typeof BaseButton> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /**
   * The action is running. The label stays, an indicator appears and clicks are ignored.
   * The button stays focusable, so a keyboard user does not lose their place.
   */
  pending?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', pending = false, disabled, className, children, ...rest }, ref) {
  const classes = typeof className === 'function' ? className : ['q-button', className].filter(Boolean).join(' ');
  return (
    <BaseButton
      {...rest}
      ref={ref}
      className={classes}
      data-variant={variant}
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      focusableWhenDisabled={pending}
    >
      {children}
    </BaseButton>
  );
});
