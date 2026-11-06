// Where a shop's money goes (spec §8a): the seller's own PayPal account, named by the email they log in with.
// Pure, so the setup and Settings screens can check an email in the browser with the same rule as the server.

/**
 * The demo shop's slug (`npm run seed`; the Start page's "See a live shop" links to it). A visitor's published Marigold
 * sample gets `marigold-bakehouse-2` and up. It is also the one shop that may have no PayPal email: it is then paid to
 * Shelfie's own sandbox account, so a fresh clone with only the app keys still runs the whole demo.
 */
export const RESERVED_SLUG = 'marigold-bakehouse';

export const PAYEE_EMAIL_MESSAGE = 'Enter the email you use to log in to PayPal, like rosa@example.com.';
export const MAX_EMAIL_LENGTH = 254;

export type PayeeEmailResult = { ok: true; email: string } | { ok: false; message: string };

/** Trimmed and lower-cased; at most 254 characters, one `@`, a dotted domain, no spaces. */
export function parsePayeeEmail(raw: unknown): PayeeEmailResult {
  const bad: PayeeEmailResult = { ok: false, message: PAYEE_EMAIL_MESSAGE };
  if (typeof raw !== 'string') return bad;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || /\s/.test(email)) return bad;
  const parts = email.split('@');
  if (parts.length !== 2) return bad;
  const [local, domain] = parts;
  const labels = domain.split('.');
  if (!local || labels.length < 2 || labels.some((l) => l === '')) return bad;
  return { ok: true, email };
}

/** `rosa@example.com` → `r•••@example.com`: enough for the buyer to recognise the shop's account, not to read it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  const first = email.slice(0, 1);
  return at < 0 ? `${first}•••` : `${first}•••${email.slice(at)}`;
}

export const isDemoShop = (shop: { slug: string }): boolean => shop.slug === RESERVED_SLUG;
