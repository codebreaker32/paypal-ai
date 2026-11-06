// Where a shop's money goes (spec §8a): the seller's own PayPal account, named by the email they log in with.
// Pure, so the setup and Settings screens can check an email in the browser with the same rule as the server.

/**
 * The demo shop's slug (`npm run seed`; the Start page's "See a live shop" links to it). A visitor's published Marigold
 * sample gets `marigold-bakehouse-2` and up. It is also the one shop that may have no PayPal email: it is then paid to
 * Shelfie's own sandbox account, so a fresh clone with only the app keys still runs the whole demo.
 */
export const RESERVED_SLUG = 'marigold-bakehouse';

export const PAYEE_EMAIL_MESSAGE = 'Enter the email you use to log in to PayPal, like rosa@example.com.';
/** Publishing needs the email: the publish gate's 409 and the setup screen's disabled-Publish reason. */
export const PAYEE_REQUIRED_MESSAGE = 'Add your PayPal email to publish.';
/** A published shop (live or paused) can change its email but not clear it: the 409 for clearing it. */
export const PAYEE_KEEP_MESSAGE = 'Your shop needs a PayPal email to take orders. To change it, enter the new one.';
export const MAX_EMAIL_LENGTH = 254;
/** Tracking on a seller-paid order stays in Shelfie: PayPal refuses it from the platform (spec §8a, verified). */
export const TRACK_IN_YOUR_PAYPAL = 'PayPal only lets the account that was paid add tracking, so add it to this payment in your PayPal account too.';

export type PayeeEmailResult = { ok: true; email: string } | { ok: false; message: string };

// The plain addresses PayPal takes as a payee (anything else is a 422 on every order): no quoted or bracketed forms.
/** Name part: letters, digits and ! # $ % & ' * + / = ? ^ _ ` { | } ~ -, in dot-separated runs (no leading, trailing or double dot). */
const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
/** RFC 5321's limits: the name part, and each label of the domain. */
const MAX_LOCAL_LENGTH = 64;
const MAX_LABEL_LENGTH = 63;
/** A domain label: letters, digits and hyphens, not starting or ending with a hyphen. */
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** The last label: two letters or more (so not an IP address). */
const TOP_LABEL = /^[a-z]{2,}$/;

const isLabel = (label: string): boolean => label.length <= MAX_LABEL_LENGTH && DOMAIN_LABEL.test(label);

/**
 * Trimmed and lower-cased; at most 254 characters, one `@`, a plain name part of at most 64, and a domain of two labels
 * or more, each at most 63, that ends in two letters or more.
 */
export function parsePayeeEmail(raw: unknown): PayeeEmailResult {
  const bad: PayeeEmailResult = { ok: false, message: PAYEE_EMAIL_MESSAGE };
  if (typeof raw !== 'string') return bad;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return bad;
  const parts = email.split('@');
  if (parts.length !== 2) return bad;
  const [local, domain] = parts;
  if (local.length > MAX_LOCAL_LENGTH || !LOCAL_PART.test(local)) return bad;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every(isLabel)) return bad;
  if (!TOP_LABEL.test(labels[labels.length - 1])) return bad;
  return { ok: true, email };
}

/** `rosa@example.com` → `r•••@example.com`: enough for the buyer to recognise the shop's account, not to read it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  const first = email.slice(0, 1);
  return at < 0 ? `${first}•••` : `${first}•••${email.slice(at)}`;
}

export const isDemoShop = (shop: { slug: string }): boolean => shop.slug === RESERVED_SLUG;

/**
 * The one rule for where a shop's money goes (spec §8a): into the seller's own PayPal account, so it needs their email.
 * Only the demo shop may have none, and is then paid to the platform account. Publishing, taking orders, clearing the
 * email and the dashboard's warning all ask this; `listOrderableForIndex` repeats it in SQL.
 */
export const canBePaid = (shop: { slug: string; payeeEmail: string | null }): boolean => shop.payeeEmail !== null || isDemoShop(shop);
