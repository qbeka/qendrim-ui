/**
 * The optional scripted run. A step can only press the same controls a visitor presses.
 * There is no step that writes to a field, so the script has no way to change anyone's text.
 */
export type ScriptStep = 'open' | 'close' | 'add' | 'resize' | 'next-row';

export const SCRIPT: ReadonlyArray<{ after: number; step: ScriptStep }> = [
  { after: 300, step: 'open' },
  // 160 ms apart, so that each one lands while the last is still moving.
  { after: 360, step: 'close' },
  { after: 160, step: 'open' },
  { after: 160, step: 'close' },
  { after: 160, step: 'open' },
  { after: 900, step: 'add' },
  { after: 800, step: 'resize' },
  { after: 1000, step: 'next-row' },
  { after: 900, step: 'resize' },
  { after: 1000, step: 'close' },
];

/** With reduced motion each step lands at once, so they are spaced out enough to read. */
export const REDUCED_STEP_MS = 900;
