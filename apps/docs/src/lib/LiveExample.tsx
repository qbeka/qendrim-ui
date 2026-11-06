import * as Q from '@qbeka/react';
import * as React from 'react';
import { Component, useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import { CopyButton } from './Copy';

/**
 * A real editable example. The code is compiled in the browser with Sucrase, which loads
 * only when this component is on the page. It runs with this library and React in scope.
 */
type Transform = (code: string) => string;

let transformer: Promise<Transform> | null = null;

function loadTransformer() {
  transformer ??= import('sucrase').then(({ transform }) => (code: string) => transform(code, { transforms: ['jsx', 'typescript'], production: true }).code);
  return transformer;
}

function compile(transform: Transform, source: string): React.ComponentType {
  const body = source.replace(/^import[^;]*;\s*$/gm, '');
  const compiled = transform(body);
  const scope = { React, _jsxs: undefined, ...React, ...Q };
  const names = Object.keys(scope).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== 'default');
  // eslint-disable-next-line no-new-func
  const run = new Function(...names, `${compiled}\nreturn Example;`);
  return run(...names.map((n) => (scope as Record<string, unknown>)[n]));
}

class Boundary extends Component<{ resetKey: string; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  override render() {
    return this.state.error ? <p className="d-error" role="alert">{this.state.error.message}</p> : this.props.children;
  }
}

export function LiveExample({ code }: { code: string }) {
  const [source, setSource] = useState(code);
  const deferred = useDeferredValue(source);
  const [Rendered, setRendered] = useState<{ Example: React.ComponentType } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTransformer().then((transform) => {
      if (cancelled) return;
      try {
        setRendered({ Example: compile(transform, deferred) });
        setError(null);
      } catch (failure) {
        setError((failure as Error).message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deferred]);

  return (
    <div className="d-live">
      <div className="d-live-stage">
        <Boundary resetKey={deferred}>{Rendered ? <Rendered.Example /> : null}</Boundary>
      </div>
      {error ? <p className="d-error" role="alert">{error}</p> : null}
      <div className="d-code">
        <textarea aria-label="Example source. Edit it to change the example above." spellCheck={false} value={source} rows={Math.min(source.split('\n').length + 1, 22)} onChange={(e) => setSource(e.target.value)} />
        <CopyButton text={source} />
      </div>
    </div>
  );
}
