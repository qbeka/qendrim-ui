import type { InspectorTrace } from '@qbeka/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DiagnosticState {
  requested: string;
  generation: number;
  phase: string;
  height: number;
  width: number;
  focus: string;
  log: string[];
}

const INITIAL: DiagnosticState = { requested: 'none yet', generation: 0, phase: 'settled', height: 0, width: 0, focus: 'none', log: [] };

const describeFocus = (element: Element | null) => {
  if (!element || element === document.body) return '<body>';
  const label = element.getAttribute('aria-label') ?? (element as HTMLInputElement).labels?.[0]?.textContent ?? element.textContent?.slice(0, 24);
  return `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
};

/** Listens to one surface. The product UI stays free of this unless the visitor turns it on. */
export function useDiagnostics(active: boolean, container: () => HTMLElement | null) {
  const [state, setState] = useState(INITIAL);
  const latest = useRef(INITIAL);

  const publish = useCallback((patch: Partial<DiagnosticState>) => {
    latest.current = { ...latest.current, ...patch };
    setState(latest.current);
  }, []);

  const onTrace = useCallback(
    (event: InspectorTrace) => {
      if (!active) return;
      const log = (line: string) => [line, ...latest.current.log].slice(0, 8);
      if (event.type === 'request') publish({ requested: event.shape, generation: event.generation, phase: 'moving', log: log(`Request ${event.shape}, generation ${event.generation}`) });
      if (event.type === 'retarget') publish({ log: log(`Retarget (${event.reason}) from ${event.from.height.toFixed(0)} px at ${event.velocity.height.toFixed(0)} px/s`) });
      if (event.type === 'settle') publish({ phase: 'settled', log: log(`Settled ${event.shape}: ${event.result}`) });
      if (event.type === 'stale-intent') publish({ log: log(`Dropped stale work from generation ${event.claimed}`) });
      if (event.type === 'snap') publish({ log: log(`No animation: ${event.reason}`) });
      if (event.type === 'focus') publish({ log: log(`Focus (${event.reason}): ${describeFocus(event.target)}${event.skipped ? `, skipped ${event.skipped}` : ''}`) });
    },
    [active, publish],
  );

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const tick = () => {
      const box = container()?.querySelector('[data-q-surface][data-shape="open"], [data-q-surface][data-phase="moving"]') ?? container()?.querySelector('[data-q-surface]');
      const rect = box?.getBoundingClientRect();
      const focus = describeFocus(document.activeElement);
      if (rect && (rect.height !== latest.current.height || rect.width !== latest.current.width || focus !== latest.current.focus)) {
        publish({ height: rect.height, width: rect.width, focus });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, container, publish]);

  return { state, onTrace };
}

export function DiagnosticPanel({ state }: { state: DiagnosticState }) {
  return (
    <aside className="ex-diagnostics" aria-label="Diagnostics" data-testid="diagnostics">
      <dl>
        <div><dt>Requested</dt><dd data-testid="diag-requested">{state.requested}</dd></div>
        <div><dt>Generation</dt><dd data-testid="diag-generation">{state.generation}</dd></div>
        <div><dt>Phase</dt><dd>{state.phase}</dd></div>
        <div><dt>Geometry</dt><dd>{state.width.toFixed(0)} by {state.height.toFixed(0)} px</dd></div>
        <div><dt>Focus owner</dt><dd data-testid="diag-focus">{state.focus}</dd></div>
      </dl>
      <ol>{state.log.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ol>
    </aside>
  );
}
