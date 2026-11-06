import type { ComponentType } from 'react';
import type { ImplProps } from '../types';
import { BrokenDuplicate, BrokenFocus, BrokenLeak, BrokenRestart, BrokenStaleCommit, BrokenStretch } from './broken';
import { MotionHeightImpl, MotionLayoutImpl } from './motion';
import { NativeGridImpl } from './native';
import { SurfaceImpl } from './surface';

export interface ImplEntry {
  label: string;
  group: 'library' | 'baseline' | 'broken';
  component: ComponentType<ImplProps>;
}

export const IMPLS: Record<string, ImplEntry> = {
  surface: { label: 'Qendrim Surface', group: 'library', component: SurfaceImpl },
  'motion-height': { label: 'Motion, height to auto', group: 'baseline', component: MotionHeightImpl },
  'motion-layout': { label: 'Motion, layout prop', group: 'baseline', component: MotionLayoutImpl },
  'native-grid': { label: 'CSS, grid track', group: 'baseline', component: NativeGridImpl },
  'broken-stale': { label: 'Broken: stale commit', group: 'broken', component: BrokenStaleCommit },
  'broken-restart': { label: 'Broken: restart', group: 'broken', component: BrokenRestart },
  'broken-focus': { label: 'Broken: focus lost', group: 'broken', component: BrokenFocus },
  'broken-stretch': { label: 'Broken: stretch', group: 'broken', component: BrokenStretch },
  'broken-duplicate': { label: 'Broken: duplicate', group: 'broken', component: BrokenDuplicate },
  'broken-leak': { label: 'Broken: leak', group: 'broken', component: BrokenLeak },
};
