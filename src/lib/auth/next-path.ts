// The only places a login may send someone back to. Pure, so a page can check `?next=` as well as the API.

/** Only used to parse relative paths; an absolute URL never matches it. */
const BASE = 'http://shelfie.invalid';
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * Normalises `next` the way a browser will read it, then accepts it only if it stays on our origin and lands on
 * `/shops`, `/shops/...` or `/account`. Control characters are refused first: the URL parser would quietly strip them.
 * Returns the normalised path, or null.
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== 'string' || next === '' || CONTROL_CHARACTER.test(next)) return null;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const { pathname } = url;
  if (pathname !== '/shops' && !pathname.startsWith('/shops/') && pathname !== '/account') return null;
  return `${pathname}${url.search}${url.hash}`;
}

/** The login page's path, coming back to `next` afterwards. */
export function loginPath(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next).replaceAll('%2F', '/')}` : '/login';
}
