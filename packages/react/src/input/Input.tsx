'use client';

import { Input as BaseInput } from '@base-ui/react/input';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface InputProps extends ComponentPropsWithoutRef<typeof BaseInput> {}

/** A native input. Inside a Field it picks up the label, description and validity. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  const classes = typeof className === 'function' ? className : ['q-input', className].filter(Boolean).join(' ');
  return <BaseInput {...rest} ref={ref} className={classes} />;
});
