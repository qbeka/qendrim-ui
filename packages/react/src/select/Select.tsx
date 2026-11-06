'use client';

import { Select as BaseSelect } from '@base-ui/react/select';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useScopeAttributes } from '../scope/Scope.js';

export interface SelectItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithoutRef<typeof BaseSelect.Root<string>>, 'items' | 'children'> {
  items: readonly SelectItem[];
  placeholder?: string;
  /** Required unless the select is inside a Field with a label. */
  'aria-label'?: string;
  /** Where the popup is portaled. Defaults to <body>. */
  container?: HTMLElement | null;
  className?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select({ items, placeholder = 'Choose', 'aria-label': ariaLabel, container, className, ...rest }, ref) {
  const scope = useScopeAttributes();
  return (
    <BaseSelect.Root {...rest} items={items as ReadonlyArray<{ value: string; label: ReactNode }>}>
      <BaseSelect.Trigger ref={ref} aria-label={ariaLabel} className={['q-select-trigger', className].filter(Boolean).join(' ')}>
        <BaseSelect.Value placeholder={placeholder} />
        <BaseSelect.Icon className="q-select-icon" aria-hidden>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" /></svg>
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container ?? undefined}>
        <BaseSelect.Positioner className="q-popup-positioner" sideOffset={4} alignItemWithTrigger={false} {...scope}>
          <BaseSelect.Popup className="q-popup q-select-popup">
            <BaseSelect.List>
              {items.map((item) => (
                <BaseSelect.Item key={item.value} value={item.value} disabled={item.disabled} className="q-select-item">
                  <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="q-select-indicator" aria-hidden>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1.5" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
});
