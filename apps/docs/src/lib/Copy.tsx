import { useCopy } from './useCopy';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const { state, copy } = useCopy(text);
  return (
    <button type="button" className="d-copy" onClick={copy} aria-label={`${label}: ${text.slice(0, 40)}`}>
      <span data-on={state === 'idle' || undefined}>{label}</span>
      <span data-on={state === 'copied' || undefined}>Copied</span>
      <span data-on={state === 'failed' || undefined}>Failed</span>
    </button>
  );
}

export function Code({ children, copy = true, label }: { children: string; copy?: boolean; label?: string }) {
  return (
    <div className="d-code" data-labelled={label ? '' : undefined}>
      {label ? <p className="d-code-label">{label}</p> : null}
      <pre tabIndex={0}><code>{children}</code></pre>
      {copy ? <CopyButton text={children} /> : null}
    </div>
  );
}
