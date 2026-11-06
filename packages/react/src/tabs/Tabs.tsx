'use client';

import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

function join(base: string, className: unknown) {
  return typeof className === 'string' ? `${base} ${className}` : base;
}

export const TabsRoot = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Root>>(function Root({ className, ...rest }, ref) {
  return <BaseTabs.Root {...rest} ref={ref} className={join('q-tabs', className)} />;
});

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.List>>(function List({ className, children, ...rest }, ref) {
  return (
    <BaseTabs.List {...rest} ref={ref} className={join('q-tabs-list', className)}>
      {children}
      <BaseTabs.Indicator className="q-tabs-indicator" />
    </BaseTabs.List>
  );
});

export const TabsTab = forwardRef<HTMLElement, ComponentPropsWithoutRef<typeof BaseTabs.Tab>>(function Tab({ className, ...rest }, ref) {
  return <BaseTabs.Tab {...rest} ref={ref as never} className={join('q-tabs-tab', className)} />;
});

export const TabsPanel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Panel>>(function Panel({ className, ...rest }, ref) {
  return <BaseTabs.Panel {...rest} ref={ref} className={join('q-tabs-panel', className)} />;
});
