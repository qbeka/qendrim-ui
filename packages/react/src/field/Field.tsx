'use client';

import { Field as BaseField } from '@base-ui/react/field';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

function join(base: string, className: unknown) {
  return typeof className === 'string' ? `${base} ${className}` : base;
}

export const FieldRoot = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseField.Root>>(function Root({ className, ...rest }, ref) {
  return <BaseField.Root {...rest} ref={ref} className={join('q-field', className)} />;
});

export const FieldLabel = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<typeof BaseField.Label>>(function Label({ className, ...rest }, ref) {
  return <BaseField.Label {...rest} ref={ref} className={join('q-field-label', className)} />;
});

export const FieldDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<typeof BaseField.Description>>(function Description({ className, ...rest }, ref) {
  return <BaseField.Description {...rest} ref={ref} className={join('q-field-description', className)} />;
});

export const FieldError = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseField.Error>>(function ErrorMessage({ className, ...rest }, ref) {
  return <BaseField.Error {...rest} ref={ref} className={join('q-field-error', className)} />;
});
