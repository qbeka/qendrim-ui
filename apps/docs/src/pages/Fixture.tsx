import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixtureBody } from '../harness/body';
import { counters, installCounters } from '../harness/counters';
import { IMPLS } from '../harness/impls';
import { Recorder } from '../harness/recorder';
import type { Requested } from '../harness/types';
import '../harness/fixture.css';

installCounters();

declare global {
  interface Window {
    __q?: { recorder: Recorder; counters: typeof counters; ready: boolean };
  }
}

/** The page every browser test and benchmark drives. It has no chrome on purpose. */
export function Fixture() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const impl = IMPLS[params.get('impl') ?? 'surface'] ?? (IMPLS['surface'] as NonNullable<(typeof IMPLS)[string]>);
  const Component = impl.component;
  const startOpen = params.get('open') === '1';
  const record = params.get('record') !== '0';

  const [open, setOpenState] = useState(startOpen);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [value, setValue] = useState('Harbor rebuild');

  const rootRef = useRef<HTMLDivElement>(null);
  const requested = useRef<Requested>(startOpen ? 'open' : 'closed');
  const rendered = useRef<Requested>(startOpen ? 'open' : 'closed');
  const deferCloseRef = useRef<((ms: number) => void) | null>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);

  const recorder = useMemo(() => new Recorder({ root: () => rootRef.current, requested: () => requested.current, rendered: () => rendered.current }), []);

  useEffect(() => {
    window.__q = { recorder, counters, ready: true };
    if (record) recorder.start();
    return () => recorder.stop();
  }, [recorder, record]);

  const setOpen = useCallback(
    (next: boolean) => {
      // window.event is set only while a browser event is being handled. A late timer has
      // none. Intent comes from the user, so a callback that fires later must not rewrite
      // it, or the detector could not tell a stale close from a real one.
      if (window.event) {
        requested.current = next ? 'open' : 'closed';
        recorder.mark('request', requested.current);
      } else {
        recorder.mark('late-commit', next ? 'open' : 'closed');
      }
      setOpenState(next);
    },
    [recorder],
  );
  const onRendered = useCallback((state: Requested) => {
    rendered.current = state;
    recorder.mark('rendered', state);
  }, [recorder]);
  const onTrace = useCallback((event: unknown) => recorder.mark('trace', event), [recorder]);

  const toggleDetails = () => {
    recorder.mark('grow');
    setDetails((d) => !d);
  };

  return (
    <main className="fx-page">
      <div className="fx-controls">
        <button type="button" data-testid="ctl-toggle" onClick={() => setOpen(!open)}>Toggle</button>
        <button type="button" data-testid="ctl-details" onClick={toggleDetails}>Details</button>
        <button type="button" data-testid="ctl-error" onClick={() => { recorder.mark('grow'); setError((e) => !e); }}>Error</button>
        <button type="button" data-testid="ctl-defer" onClick={() => { requested.current = 'closed'; recorder.mark('defer'); deferCloseRef.current?.(Number(params.get('defer') ?? 600)); }}>Deferred close</button>
        <button type="button" data-testid="ctl-unmount" onClick={() => setMounted((m) => !m)}>{mounted ? 'Remove' : 'Restore'}</button>
      </div>
      <div ref={rootRef} className="fx-stage" data-impl={params.get('impl') ?? 'surface'}>
        {mounted ? (
          <Component
            open={open}
            setOpen={setOpen}
            onRendered={onRendered}
            onTrace={onTrace}
            deferCloseRef={deferCloseRef}
            fallbackFocusRef={fallbackFocusRef}
            body={<FixtureBody value={value} onValue={setValue} details={details} error={error} onDetails={toggleDetails} />}
          />
        ) : null}
        <div className="fx-after" data-probe="after">Next row in the list</div>
      </div>
      <button ref={(n) => { fallbackFocusRef.current = n; }} type="button" data-testid="fallback" data-probe="fallback">Focus fallback</button>
    </main>
  );
}
