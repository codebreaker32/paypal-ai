// Publish a shop's reviewed menu to PayPal's catalog (spec §8, "Publish, per item").
// Each publishable item becomes a PayPal product; prices stay in Shelfie. Safe to re-run:
// items that already have a PayPal product are skipped, and the request id is stable per item.
import type { Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import { slugify } from '@/lib/domain/ids';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';
import { categoryFor } from '@/lib/paypal/categories';
import { PayPalApiError, type CreateProductInput, type PayPalPort } from '@/lib/paypal/types';
import { isPendingPublish } from './rules';

export const PUBLISH_CONCURRENCY = 3;
const MAX_DESCRIPTION = 256;

export interface PublishDeps {
  db: Db;
  paypal: Pick<PayPalPort, 'createProduct'>;
}

export type PublishProgress =
  | { type: 'item'; itemId: string; ok: true; paypalProductId: string }
  | { type: 'item'; itemId: string; ok: false; message: string };

export interface PublishResult {
  published: number;
  failed: { itemId: string; message: string }[];
}

/** Items a publish run would send to PayPal now (resolved, priced, not yet in PayPal). */
export function itemsToPublish(db: Db, shopId: string): ItemWithVariants[] {
  return items.listWithVariants(db, shopId, { status: ['draft'] }).filter(isPendingPublish);
}

export function productFor(item: ItemWithVariants, shop: Shop): CreateProductInput {
  const p: CreateProductInput = { name: item.name.slice(0, 127), type: item.kind };
  const description = (item.description ?? item.section ?? '').trim().slice(0, MAX_DESCRIPTION);
  if (description) p.description = description;
  const category = categoryFor(shop.kind);
  if (category) p.category = category;
  return p;
}

// What the seller reads when an item doesn't reach PayPal. PayPal's own text ("Request is not
// well-formed…", "Client Authentication failed") and Node's ("fetch failed") stay in the server log.
const SELLER_MESSAGES = {
  details: "PayPal didn’t accept this item’s name or description.",
  keys: "PayPal didn’t accept Shelfie’s sandbox keys. Check PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY in .env, then retry.",
  busy: 'PayPal is busy right now. Wait a minute, then retry.',
  outage: 'PayPal had a problem on its side. Retry in a moment.',
  offline: "We couldn’t reach PayPal. Check the connection, then retry.",
  other: "PayPal didn’t add this item. Retry in a moment.",
} as const;

const NETWORK_ERROR = /fetch failed|network|socket|timed? ?out|timeout|abort|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR/i;

/** A plain, specific message for the seller. */
export function sellerMessageFor(err: unknown): string {
  if (err instanceof PayPalApiError) {
    if (err.status === 401 || err.status === 403 || err.errorName === 'invalid_client') return SELLER_MESSAGES.keys;
    if (err.status === 400 || err.status === 422) return SELLER_MESSAGES.details;
    if (err.status === 429) return SELLER_MESSAGES.busy;
    if (err.status >= 500) return SELLER_MESSAGES.outage;
    return SELLER_MESSAGES.other;
  }
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: unknown; message?: unknown } }).cause;
    const text = `${err.name} ${err.message} ${String(cause?.code ?? '')} ${String(cause?.message ?? '')}`;
    if (NETWORK_ERROR.test(text)) return SELLER_MESSAGES.offline;
  }
  return SELLER_MESSAGES.other;
}

/** The raw error for the server log: PayPal's status, name, issue and debug id, or Node's error and cause. */
function describeError(err: unknown): string {
  if (err instanceof PayPalApiError) {
    return `${err.status} ${err.errorName}${err.issue ? `/${err.issue}` : ''} debug_id=${err.debugId ?? '-'}: ${err.message}`;
  }
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: unknown; message?: unknown } }).cause;
    return `${err.name}: ${err.message}${cause ? ` (cause: ${String(cause.code ?? '')} ${String(cause.message ?? '')})` : ''}`;
  }
  return String(err);
}

/** Runs fn over list with at most `limit` calls in flight. */
async function pool<T>(list: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < list.length) await fn(list[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
}

// Shops start with a throwaway "draft-xxxxxxxx" slug (src/lib/catalog/setup.ts) because the real
// name is only known after the menu is read and reviewed. The public slug is fixed at first publish.
const DRAFT_SLUG = /^draft-[a-z0-9]{8}(-\d+)?$/;

/**
 * The demo shop's slug (`npm run seed`; the Start page's "See a live shop" links to it). A visitor's
 * published Marigold sample gets `marigold-bakehouse-2` and up, even before the demo shop exists.
 */
export const RESERVED_SLUG = 'marigold-bakehouse';

function assignRealSlug(db: Db, shop: Shop): void {
  if (shop.publishedAt || !DRAFT_SLUG.test(shop.slug)) return;
  let slugFrom = shop.name;
  if (slugify(slugFrom) === RESERVED_SLUG) {
    let n = 2;
    while (shops.bySlug(db, `${RESERVED_SLUG}-${n}`)) n++;
    slugFrom = `${RESERVED_SLUG}-${n}`;
  }
  shops.setSlug(db, shop.id, slugFrom);
}

/**
 * A draft shop with at least one item already in PayPal can go live. Normally a publish run does
 * that at its end; this is also true when a run broke after its items reached PayPal (a re-POST
 * then has nothing to send and only finishes going live).
 */
export function canGoLive(db: Db, shopId: string): boolean {
  return shops.byId(db, shopId)?.status === 'draft' && items.listWithVariants(db, shopId, { status: ['live'] }).length > 0;
}

/** Gives a draft shop with items in PayPal its real slug and makes it live (a paused shop stays paused). */
function goLiveIfReady(db: Db, shopId: string): void {
  db.transaction(() => {
    if (!canGoLive(db, shopId)) return;
    assignRealSlug(db, shops.byId(db, shopId)!);
    shops.publish(db, shopId);
  })();
}

/** Progress goes to a listener (the browser's stream) that may be gone; it never affects the run. */
function notify(onProgress: ((e: PublishProgress) => void) | undefined, e: PublishProgress, run: { listenerFailed: boolean }): void {
  if (!onProgress) return;
  try {
    onProgress(e);
  } catch (err) {
    if (!run.listenerFailed) console.warn('publish: progress listener failed:', err instanceof Error ? err.message : err);
    run.listenerFailed = true;
  }
}

/**
 * Publishes every resolved, fully priced draft item (3 at a time, request id `pub-<itemId>`),
 * marks each one live, and makes a draft shop live once at least one item is in PayPal.
 * "Ask in person" items are listed on the shop but never sent to PayPal. `onProgress` hears about
 * each item after its result is recorded; if it throws, the run carries on regardless.
 */
export async function publishShop(
  deps: PublishDeps,
  shopId: string,
  onProgress?: (e: PublishProgress) => void,
): Promise<PublishResult> {
  const { db, paypal } = deps;
  const shop = shops.byId(db, shopId);
  if (!shop) throw new Error(`publishShop: unknown shop ${shopId}`);

  const todo = itemsToPublish(db, shopId);
  const result: PublishResult = { published: 0, failed: [] };
  const run = { listenerFailed: false };

  await pool(todo, PUBLISH_CONCURRENCY, async (queued) => {
    // Read again at its turn, so a rename made since the run started reaches PayPal. (An item
    // removed meanwhile is still sent, but setPayPalProductId leaves it removed.)
    const item = items.byIdForShop(db, shopId, queued.id) ?? queued;
    let event: PublishProgress;
    try {
      const { id } = await paypal.createProduct(productFor(item, shop), `pub-${item.id}`);
      items.setPayPalProductId(db, item.id, id);
      result.published++;
      event = { type: 'item', itemId: item.id, ok: true, paypalProductId: id };
    } catch (err) {
      console.warn(`publish: item ${item.id} not added to PayPal: ${describeError(err)}`);
      const message = sellerMessageFor(err);
      result.failed.push({ itemId: item.id, message });
      event = { type: 'item', itemId: item.id, ok: false, message };
    }
    notify(onProgress, event, run);
  });

  goLiveIfReady(db, shopId);
  return result;
}
