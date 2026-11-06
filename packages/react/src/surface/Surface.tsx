'use client';

import { Component, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { browserClock, createDomPort } from '../core/dom-port.js';
import { createEngine, type Engine, type TraceEvent } from '../core/engine.js';
import type { IntentToken, MachineSnapshot } from '../core/machine.js';

/** useLayoutEffect warns during server rendering in React 18, and it has no work to do there. */
export const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

export interface SurfaceHandle {
  /** Take this before starting work that ends later. Any newer intent makes it stale. */
  token(): IntentToken;
  /** Runs the action only if the token is still current. Stale actions are dropped and traced. */
  ifCurrent(token: IntentToken, action: () => void): boolean;
  /** Marks a newer intent that is not a shape change, such as typing during a deferred close. */
  invalidate(): void;
  snapshot(): MachineSnapshot;
}

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** The desired shape. CSS decides what it looks like, using `[data-shape]`. */
  shape: string;
  /** Called when a move finishes for the latest request. Never called for a superseded one. */
  onSettle?: (shape: string) => void;
  /** Receives engine events. Used by diagnostics. Has no effect on behavior. */
  onTrace?: (event: TraceEvent) => void;
  handleRef?: RefObject<SurfaceHandle | null>;
  children?: ReactNode;
}

interface SnapshotProps {
  shape: string;
  capture: () => void;
  children: ReactNode;
}

/**
 * The only class component in the library. getSnapshotBeforeUpdate is the only React API
 * that runs after a render commits and before the DOM changes, which is the one moment
 * the old box can still be read. A function component would read the box too late.
 */
class BeforeMutation extends Component<SnapshotProps> {
  override getSnapshotBeforeUpdate(previous: SnapshotProps) {
    if (previous.shape !== this.props.shape) this.props.capture();
    return null;
  }

  override componentDidUpdate() {
    // React requires this method when getSnapshotBeforeUpdate exists.
  }

  override render() {
    return this.props.children;
  }
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { shape, onSettle, onTrace, handleRef, children, ...rest },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  // The engine outlives renders, so it calls the latest callbacks through a ref.
  const callbacks = useRef({ onSettle, onTrace });
  useIsomorphicLayoutEffect(() => {
    callbacks.current = { onSettle, onTrace };
  });

  const initialShape = useRef(shape);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return undefined;

    const engine = createEngine({
      initial: initialShape.current,
      port: createDomPort(root, content),
      clock: browserClock,
      onSettle: (settled) => callbacks.current.onSettle?.(settled),
      onTrace: (event) => callbacks.current.onTrace?.(event),
    });
    engineRef.current = engine;
    if (handleRef) {
      handleRef.current = {
        token: () => engine.token(),
        ifCurrent: (token, action) => engine.ifCurrent(token, action),
        invalidate: () => engine.invalidate(),
        snapshot: () => engine.snapshot(),
      };
    }

    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize[0];
      if (size) engine.contentResized(size.inlineSize, size.blockSize);
    });
    observer.observe(content);

    const onViewportChange = () => engine.viewportChanged();
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      engine.destroy();
      engineRef.current = null;
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef]);

  // Keeps the engine in step across a StrictMode remount, where it is built fresh.
  useIsomorphicLayoutEffect(() => {
    initialShape.current = shape;
    engineRef.current?.commit(shape);
  }, [shape]);

  const capture = useCallback(() => engineRef.current?.capture(), []);

  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  return (
    <BeforeMutation shape={shape} capture={capture}>
      <div {...rest} ref={setRoot} data-q-surface="" data-shape={shape} data-phase="settled">
        <div ref={contentRef} data-q-surface-content="">
          {children}
        </div>
      </div>
    </BeforeMutation>
  );
});
