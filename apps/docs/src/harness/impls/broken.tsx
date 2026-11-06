/**
 * TEST FIXTURES. DO NOT COPY. Each component here breaks one rule on purpose, so the
 * harness can show that it detects that failure. A control that goes undetected
 * invalidates the result. None of this ships in the package.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ImplProps } from '../types';

const DURATION_MS = 400;
const OPEN_HEIGHT = 460;
const CLOSED_HEIGHT = 52;

function Trigger({ open, setOpen, triggerRef }: Pick<ImplProps, 'open' | 'setOpen'> & { triggerRef?: React.Ref<HTMLButtonElement> }) {
  return <button ref={triggerRef} type="button" className="fx-trigger" data-probe="trigger" aria-expanded={open} onClick={() => setOpen(!open)}>Harbor rebuild</button>;
}

/** Rule M3 broken: the close timer is never cancelled, so it hides a reopened panel. */
export function BrokenStaleCommit({ open, setOpen, onRendered, body, deferCloseRef }: ImplProps) {
  const [hidden, setHidden] = useState(true);
  const wasOpen = useRef(open);
  useEffect(() => {
    deferCloseRef.current = (ms) => {
      setTimeout(() => setOpen(false), ms); // No guard: it fires however the user has changed their mind.
    };
  }, [deferCloseRef, setOpen]);
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    if (open) {
      setHidden(false);
      setTimeout(() => onRendered('open'), DURATION_MS);
    } else {
      setTimeout(() => {
        setHidden(true);
        onRendered('closed');
      }, DURATION_MS);
    }
  }, [open, onRendered]);
  return (
    <div className="fx-box fx-plain fx-fixed" data-probe="box" style={{ height: open ? OPEN_HEIGHT : CLOSED_HEIGHT, overflow: 'hidden', transition: `height ${DURATION_MS}ms linear` }}>
      <Trigger open={open} setOpen={setOpen} />
      <div hidden={hidden}>{body}</div>
    </div>
  );
}

/** Retarget broken: each move restarts from the end of the last move, not from where the box is. */
export function BrokenRestart({ open, setOpen, onRendered, body }: ImplProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    animation.current?.cancel();
    const from = open ? CLOSED_HEIGHT : OPEN_HEIGHT;
    const to = open ? OPEN_HEIGHT : CLOSED_HEIGHT;
    const current = boxRef.current?.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 900, easing: 'linear', fill: 'both' });
    if (!current) return;
    animation.current = current;
    current.onfinish = () => onRendered(open ? 'open' : 'closed');
  }, [open, onRendered]);
  return (
    <div ref={boxRef} className="fx-box fx-plain fx-fixed" data-probe="box" style={{ height: CLOSED_HEIGHT, overflow: 'hidden' }}>
      <Trigger open={open} setOpen={setOpen} />
      <div>{body}</div>
    </div>
  );
}

/** Rule F4 broken: the panel is removed with focus inside it, and focus falls to <body>. */
export function BrokenFocus({ open, setOpen, onRendered, body }: ImplProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open) panelRef.current?.querySelector('input')?.focus();
    onRendered(open ? 'open' : 'closed');
  }, [open, onRendered]);
  return (
    <div className="fx-box fx-plain" data-probe="box">
      <Trigger open={open} setOpen={setOpen} />
      {open ? <div ref={panelRef}>{body}</div> : null}
    </div>
  );
}

/** Geometry rule broken: a scale transform on the panel stretches the field during the move. */
export function BrokenStretch({ open, setOpen, onRendered, body }: ImplProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    const panel = panelRef.current;
    const animation = panel?.animate([{ transform: open ? 'scaleY(0.4)' : 'scaleY(1)' }, { transform: open ? 'scaleY(1)' : 'scaleY(0.4)' }], { duration: DURATION_MS, easing: 'linear' });
    if (animation) animation.onfinish = () => onRendered(open ? 'open' : 'closed');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fx-box fx-plain" data-probe="box" style={{ overflow: 'hidden' }}>
      <Trigger open={open} setOpen={setOpen} />
      <div ref={panelRef} style={{ transformOrigin: 'top', display: open ? 'block' : undefined, visibility: open ? 'visible' : 'hidden', height: open ? undefined : 0 }}>{body}</div>
    </div>
  );
}

/** Rule F2 broken: a live copy of the panel appears during the move. */
export function BrokenDuplicate({ open, setOpen, onRendered, body }: ImplProps) {
  const [ghost, setGhost] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    setGhost(true);
    const timer = setTimeout(() => {
      setGhost(false);
      onRendered(open ? 'open' : 'closed');
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [open, onRendered]);
  return (
    <div className="fx-box fx-plain" data-probe="box">
      <Trigger open={open} setOpen={setOpen} />
      {open ? <div>{body}</div> : null}
      {ghost ? <div className="fx-ghost">{body}</div> : null}
    </div>
  );
}

/** Cleanup broken: nothing started here is ever stopped. */
export function BrokenLeak({ open, setOpen, onRendered, body }: ImplProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(() => undefined);
    if (boxRef.current) observer.observe(boxRef.current);
    const onResize = () => undefined;
    window.addEventListener('resize', onResize);
    setInterval(() => undefined, 1000);
    const loop = () => {
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // No cleanup, on purpose.
  }, []);
  useEffect(() => onRendered(open ? 'open' : 'closed'), [open, onRendered]);
  return (
    <div ref={boxRef} className="fx-box fx-plain" data-probe="box">
      <Trigger open={open} setOpen={setOpen} />
      {open ? <div>{body}</div> : null}
    </div>
  );
}
