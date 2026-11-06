import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/** The clipboard can refuse, for example in an embedded frame, so failure is a state too. */
export function useCopy(text: string) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = window.setTimeout(() => setState('idle'), 1600);
  }, [text]);
  return { state, copy };
}
