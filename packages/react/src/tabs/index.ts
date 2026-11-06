import { TabsList, TabsPanel, TabsRoot, TabsTab } from './Tabs.js';

/**
 * Built here, outside the 'use client' file, on purpose. In a React Server Component, a
 * client module's exports are opaque references, so reading a property of one fails. This
 * file has no directive, so this is a plain object and `X.Root` works on the server.
 */
export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Panel: TabsPanel };
