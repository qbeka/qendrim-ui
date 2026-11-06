'use client';

import { Field as BaseField } from '@base-ui/react/field';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

function join(base: string, className: unknown) {
  return typeof className === 'string' ? `${base} ${className}` : base;
}

const Root = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseField.Root>>(function FieldRoot({ className, ...rest }, ref) {
  return <BaseField.Root {...rest} ref={ref} className={join('q-field', className)} />;
});

const Label = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<typeof BaseField.Label>>(function FieldLabel({ className, ...rest }, ref) {
  return <BaseField.Label {...rest} ref={ref} className={join('q-field-label', className)} />;
});

const Description = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<typeof BaseField.Description>>(function FieldDescription({ className, ...rest }, ref) {
  return <BaseField.Description {...rest} ref={ref} className={join('q-field-description', className)} />;
});

const ErrorMessage = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseField.Error>>(function FieldError({ className, ...rest }, ref) {
  return <BaseField.Error {...rest} ref={ref} className={join('q-field-error', className)} />;
});

export const Field = { Root, Label, Description, Error: ErrorMessage };
