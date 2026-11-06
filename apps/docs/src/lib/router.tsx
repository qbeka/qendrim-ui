import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** A small pushState router. The base path comes from the build, so the site can live under any folder. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
};

const readPath = () => {
  const path = window.location.pathname;
  return (path.startsWith(BASE) ? path.slice(BASE.length) : path) || '/';
};

export const usePath = () => useSyncExternalStore(subscribe, readPath);

export function navigate(to: string) {
  window.history.pushState(null, '', `${BASE}${to}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a {...rest} href={`${BASE}${to}`} onClick={handle} />;
}
