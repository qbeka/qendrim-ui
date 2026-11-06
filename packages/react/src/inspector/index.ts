import { InspectorClose, InspectorPanel, InspectorRoot, InspectorTrigger } from './Inspector.js';
import { ModalInspectorRoot } from './ModalInspector.js';

/**
 * Built here, outside the 'use client' files, on purpose. In a React Server Component, a
 * client module's exports are opaque references, so reading a property of one fails. This
 * file has no directive, so these are plain objects and `X.Root` works on the server.
 */
export const Inspector = { Root: InspectorRoot, Trigger: InspectorTrigger, Panel: InspectorPanel, Close: InspectorClose };

export const ModalInspector = { Root: ModalInspectorRoot, Trigger: InspectorTrigger, Panel: InspectorPanel, Close: InspectorClose };

export { useInspector } from './Inspector.js';
export type { FocusReason, FocusTrace, InspectorCloseProps, InspectorPanelProps, InspectorRootProps, InspectorTrace, InspectorTriggerProps } from './Inspector.js';
export type { ModalInspectorRootProps } from './ModalInspector.js';
