import { useState } from 'react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="d-copy" onClick={copy} aria-label={`${label}: ${text.slice(0, 40)}`}>
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

export function Code({ children, copy = true }: { children: string; copy?: boolean }) {
  return (
    <div className="d-code">
      <pre tabIndex={0}><code>{children}</code></pre>
      {copy ? <CopyButton text={children} /> : null}
    </div>
  );
}
