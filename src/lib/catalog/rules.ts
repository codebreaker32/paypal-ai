// Pure catalog rules shared by the server (publish) and the review screen (counts, cards).
// No server imports here: client components use this file.
import type { IssueCode, ItemWithVariants, Variant } from '@/lib/domain/types';

/** $500: a new shop's online order cap (shops.order_cap_cents), so one of anything can be ordered. */
export const MAX_PRICE_CENTS = 50_000;
/** The most sizes or options one item can have (a reading keeps the first ones; edits accept no more). */
export const MAX_VARIANTS = 10;

type ItemLike = Pick<ItemWithVariants, 'status' | 'issues' | 'paypalProductId'> & {
  variants: Pick<Variant, 'priceCents'>[];
};

/** Every option has a price the door can sell: over $0 and within the order cap. */
export const isPriced = (it: Pick<ItemLike, 'variants'>): boolean =>
  it.variants.length > 0 && it.variants.every((v) => v.priceCents != null && v.priceCents > 0 && v.priceCents <= MAX_PRICE_CENTS);

/** A draft the seller has cleared and fully priced: it goes to PayPal on publish. */
export function isPublishable(it: ItemLike): boolean {
  return it.status === 'draft' && it.issues.length === 0 && isPriced(it);
}

/** Publishable and not yet in PayPal (what a publish run, or a retry, will send). */
export function isPendingPublish(it: ItemLike): boolean {
  return isPublishable(it) && !it.paypalProductId;
}

/** Items on the review's "needs you" list. Removed items never are; "ask in person" items are once resolved. */
export function needsSeller(it: ItemLike): boolean {
  return it.status !== 'removed' && it.issues.length > 0;
}

/**
 * Which fix the card offers. A missing price comes first (the seller must type one), then
 * market price, duplicates and finally a plain check.
 */
export type CardKind = 'price' | 'market' | 'duplicate' | 'check';

export function cardKindFor(it: ItemLike & { issues: IssueCode[] }): CardKind {
  if (it.issues.includes('MARKET_PRICE')) return 'market';
  if (it.issues.includes('MISSING_PRICE') || !isPriced(it)) return 'price';
  if (it.issues.includes('DUPLICATE')) return 'duplicate';
  return 'check';
}

/** Dollars typed on a decimal keypad → integer cents. "4.5" → 450, "$12" → 1200. $0 or anything else → null. */
export function parsePriceInput(raw: string): number | null {
  const s = raw.trim().replace(/^\$\s*/, '').replace(',', '.');
  if (!/^\d{1,4}(\.\d{0,2})?$|^\.\d{1,2}$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return cents > 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

/** Cents → what goes back into a price field: 450 → "4.50", 1200 → "12". */
export function priceInputValue(cents: number | null): string {
  if (cents == null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** The first dollar amount in a line of text ("+$1.5 add guac" → 150), for prefilling. */
export function firstAmountIn(text: string): number | null {
  const m = /\$\s?(\d{1,4}(?:\.\d{1,2})?)/.exec(text);
  return m ? parsePriceInput(m[1]) : null;
}
