import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/**
 * A small pushState router. The base path comes from the build, so the site can live under
 * any folder. A host with no rewrites, such as a folder of static files on another site, builds
 * with VITE_HASH_ROUTES=1, so routes live in the hash and no deep link can reach the server.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const HASH = import.meta.env['VITE_HASH_ROUTES'] === '1';

const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
  };
};

// A hash such as #main is a place on the page, not a route, so the route stays as it was.
let lastHashPath = '/';

const readPath = () => {
  if (HASH) {
    const { hash } = window.location;
    if (hash.startsWith('#/')) lastHashPath = hash.slice(1);
    else if (hash === '') lastHashPath = '/';
    return lastHashPath;
  }
  const path = window.location.pathname;
  return (path.startsWith(BASE) ? path.slice(BASE.length) : path) || '/';
};

export const usePath = () => useSyncExternalStore(subscribe, readPath);

export function navigate(to: string) {
  window.history.pushState(null, '', HASH ? `#${to}` : `${BASE}${to}`);
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
  return <a {...rest} href={HASH ? `#${to}` : `${BASE}${to}`} onClick={handle} />;
}
