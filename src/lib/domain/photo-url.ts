// Item photos and shop covers are stored site-relative ("/demo/<shop>/<file>.jpg", "/i/<file>"). Agents and search
// engines read them from outside the site, so the agent door and the JSON-LD send them absolute.

/** `photoUrl` made absolute against `base` (APP_URL or any URL on the site), or null for no photo or a malformed one. */
export function absolutePhotoUrl(base: string, photoUrl: string | null): string | null {
  if (!photoUrl?.startsWith('/')) return null;
  try {
    const site = new URL(base);
    const url = new URL(photoUrl, site);
    // "//host/x" or "/\\host/x" would leave the site: only a path on the same origin is a photo URL.
    return url.origin === site.origin ? url.href : null;
  } catch {
    return null;
  }
}
