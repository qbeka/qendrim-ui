import { Inspector, useInspector } from '@qbeka/react/inspector';
import { useEffect } from 'react';
import type { ImplProps } from '../types';

function DeferBridge({ deferCloseRef }: Pick<ImplProps, 'deferCloseRef'>) {
  const { closeAfter } = useInspector();
  useEffect(() => {
    deferCloseRef.current = (ms) => {
      void closeAfter(new Promise((resolve) => setTimeout(resolve, ms)));
    };
    return () => {
      deferCloseRef.current = null;
    };
  }, [closeAfter, deferCloseRef]);
  return null;
}

/** The library: Inspector, which is Surface plus the focus policy. */
export function SurfaceImpl({ open, setOpen, onRendered, onTrace, body, deferCloseRef, fallbackFocusRef }: ImplProps) {
  return (
    <Inspector.Root fallbackFocusRef={fallbackFocusRef} open={open} onOpenChange={setOpen} onSettle={(shape) => onRendered(shape === 'open' ? 'open' : 'closed')} onTrace={onTrace} data-probe="box" className="fx-box">
      <Inspector.Trigger data-probe="trigger">Harbor rebuild</Inspector.Trigger>
      <Inspector.Panel label="Harbor rebuild">
        <DeferBridge deferCloseRef={deferCloseRef} />
        {body}
      </Inspector.Panel>
    </Inspector.Root>
  );
}
