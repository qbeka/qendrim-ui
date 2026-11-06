'use client';

import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

function join(base: string, className: unknown) {
  return typeof className === 'string' ? `${base} ${className}` : base;
}

const Root = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Root>>(function TabsRoot({ className, ...rest }, ref) {
  return <BaseTabs.Root {...rest} ref={ref} className={join('q-tabs', className)} />;
});

const List = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.List>>(function TabsList({ className, children, ...rest }, ref) {
  return (
    <BaseTabs.List {...rest} ref={ref} className={join('q-tabs-list', className)}>
      {children}
      <BaseTabs.Indicator className="q-tabs-indicator" />
    </BaseTabs.List>
  );
});

const Tab = forwardRef<HTMLElement, ComponentPropsWithoutRef<typeof BaseTabs.Tab>>(function TabsTab({ className, ...rest }, ref) {
  return <BaseTabs.Tab {...rest} ref={ref as never} className={join('q-tabs-tab', className)} />;
});

const Panel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Panel>>(function TabsPanel({ className, ...rest }, ref) {
  return <BaseTabs.Panel {...rest} ref={ref} className={join('q-tabs-panel', className)} />;
});

export const Tabs = { Root, List, Tab, Panel };
