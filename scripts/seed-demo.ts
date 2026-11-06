// npm run seed [-- --reset | --cancel-unpaid]
// Creates the demo shop "Marigold Bakehouse" from the recorded menu reading, resolves its review issues as a seller
// would, publishes its items to the real PayPal sandbox catalog with the setup flow's own publishShop, and marks it
// live. Idempotent: a second run reuses the shop and only publishes what is missing (an item PayPal turned down last
// time, say). --reset deletes the shop (and its orders) and starts again. Every run reports the demo shop's orders still
// waiting for payment (one caller can hold 3); --cancel-unpaid cancels them before a recording.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeExtraction } from '@/lib/ai/normalize';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { RESERVED_SLUG, publishShop, type PublishResult } from '@/lib/catalog/publish';
import { ConfigError, getConfig } from '@/lib/config';
import { maskEmail, parsePayeeEmail } from '@/lib/domain/payee';
import { getDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import type { Shop } from '@/lib/domain/types';
import { cancelOrder, syncOrder } from '@/lib/orders/service';
import type { PayPalPort } from '@/lib/paypal/types';

config({ quiet: true });

export const DEMO_SHOP = {
  name: 'Marigold Bakehouse',
  /** Reserved for this shop: a visitor's published Marigold sample gets marigold-bakehouse-2 and up. */
  slug: RESERVED_SLUG,
  about: 'Small-batch breads and pastries, baked at home for weekend pickup or shipping.',
  fulfillment: 'both',
  shippingFeeCents: 800,
} as const;

const FIXTURE = 'tests/ai/fixtures/marigold.json';
const PHOTO = 'public/samples/marigold-bakehouse.jpg';
/**
 * The seed's marker: its shop's menu photo is stored as `<shopId>/demo-marigold-bakehouse.jpg`. Uploads and samples are
 * stored as page-N.jpg, page-N-<stamp>.jpg or sample-<id>.jpg (src/lib/catalog/setup.ts), so no other shop has it.
 */
export const DEMO_PHOTO = 'demo-marigold-bakehouse.jpg';

/** True for the shop this script created (or an older seed's, made before the marker: its about text and page-1.jpg). */
function isSeedShop(shop: Shop): boolean {
  const photo = shop.menuPhotoPaths[0];
  return photo === `${shop.id}/${DEMO_PHOTO}` || (photo === `${shop.id}/page-1.jpg` && shop.about === DEMO_SHOP.about);
}

export interface SeedOptions {
  db: Db;
  paypal: PayPalPort;
  uploadsDir: string;
  reset?: boolean;
  /** Cancel the demo shop's orders still waiting for buyer approval (rehearsal orders before a recording). */
  cancelUnpaid?: boolean;
  /**
   * The sandbox seller's PayPal email (PAYPAL_SANDBOX_SELLER_EMAIL, already checked): the demo shop is paid there, like
   * any other shop. Without it the demo shop is paid to the platform account (spec §8a). Applied on every run.
   */
  payeeEmail?: string | null;
  log?: (line: string) => void;
}

export interface SeedResult {
  shop: Shop;
  /** The raw owner token, only when this run created the shop (only its hash is stored). */
  ownerToken: string | null;
  created: boolean;
  /** Items this run added to the PayPal catalog. */
  published: number;
  /** Items PayPal turned down this run, with the seller's message; a re-run retries them. */
  failed: PublishResult['failed'];
  /** Orders still waiting for buyer approval after this run. */
  unpaid: number;
  /** Unpaid orders this run cancelled (cancelUnpaid). */
  cancelled: number;
  /** Where the demo shop's new orders are paid (the email masked, so it is safe to print). */
  payee: { kind: 'seller'; maskedEmail: string } | { kind: 'platform' };
}

export async function seedDemoShop(opts: SeedOptions): Promise<SeedResult> {
  const { db, uploadsDir } = opts;
  const log = opts.log ?? (() => {});
  let shop = shops.bySlug(db, DEMO_SHOP.slug);
  // Never adopt, change or delete a shop the seed didn't make (one published before the slug was reserved).
  if (shop && !isSeedShop(shop)) {
    throw new Error(
      `${DEMO_SHOP.slug} belongs to ${shop.name} (${shop.id}), which is not the demo shop: the seed didn't create it, so it leaves it alone. ` +
        'Use a fresh DATABASE_PATH for the demo shop.',
    );
  }

  if (shop && opts.reset) {
    log(`Deleting ${shop.name} (${shop.id}) and its orders…`);
    db.prepare('DELETE FROM shops WHERE id = ?').run(shop.id);
    fs.rmSync(path.join(uploadsDir, shop.id), { recursive: true, force: true });
    shop = null;
  }

  let ownerToken: string | null = null;
  const created = !shop;
  if (!shop) {
    const catalog = normalizeExtraction(JSON.parse(fs.readFileSync(path.resolve(FIXTURE), 'utf8')) as MenuExtraction);
    if ('unreadable' in catalog) throw new Error(`The recorded Marigold reading is unreadable: ${catalog.reason}`);
    const made = shops.create(db, {
      name: DEMO_SHOP.name,
      about: DEMO_SHOP.about,
      kind: catalog.kind,
      fulfillment: DEMO_SHOP.fulfillment,
      pickupNotes: catalog.shop.pickupNotes,
      shippingFeeCents: DEMO_SHOP.shippingFeeCents,
    });
    shop = made.shop;
    ownerToken = made.ownerToken;
    if (shop.slug !== DEMO_SHOP.slug) throw new Error(`Expected slug ${DEMO_SHOP.slug}, got ${shop.slug}`);
    items.replaceDrafts(db, shop.id, catalog.items);
    resolveLikeASeller(db, shop.id);
    log(`Created ${shop.name} with ${catalog.items.length} items from the recorded menu reading.`);
  }

  const shopId = shop.id;
  const payeeEmail = opts.payeeEmail ?? null;
  // Every run follows the env var: a changed or removed PAYPAL_SANDBOX_SELLER_EMAIL changes where new orders are paid.
  shops.update(db, shopId, { menuPhotoPaths: [ensurePhoto(uploadsDir, shopId)], payeeEmail });
  // The setup flow's own publish: same products, same request ids, and it makes the shop live.
  const result = await publishShop({ db, paypal: opts.paypal }, shopId, (e) => {
    const name = items.byIdForShop(db, shopId, e.itemId)?.name ?? e.itemId;
    log(e.ok ? `  PayPal product ${e.paypalProductId}  ${name}` : `  Not added: ${name}: ${e.message}`);
  });
  // Orders past their expiry no longer hold a caller's unpaid-order cap, so only live ones are reported.
  const waiting = () => orders.listByShop(db, shopId, { status: ['awaiting_approval'] }).filter((o) => Date.parse(o.expiresAt) > Date.now());
  let cancelled = 0;
  if (opts.cancelUnpaid) {
    const deps = { db, paypal: opts.paypal, appUrl: getConfig().appUrl };
    for (const o of orders.listByShop(db, shopId, { status: ['awaiting_approval'] })) {
      // Ask PayPal first: a buyer who approved a moment ago is captured, not cancelled.
      const synced = await syncOrder(deps, o.id, 'poller').catch(() => o);
      if (synced.status !== 'awaiting_approval') continue;
      if ((await cancelOrder(deps, o.id, 'seller')).status === 'cancelled') cancelled++;
    }
  }
  return {
    shop: shops.byId(db, shopId)!, ownerToken, created, published: result.published, failed: result.failed,
    unpaid: waiting().length, cancelled,
    payee: payeeEmail ? { kind: 'seller', maskedEmail: maskEmail(payeeEmail) } : { kind: 'platform' },
  };
}

/** What a seller does on the review screen: "Looks right" on every CHECK, "Ask in person" on market prices. */
function resolveLikeASeller(db: Db, shopId: string): void {
  for (const item of items.listWithVariants(db, shopId)) {
    if (!item.issues.length) continue;
    if (item.issues.includes('MARKET_PRICE') || item.issues.includes('MISSING_PRICE')) {
      items.update(db, item.id, { status: 'in_person', issues: [], issueDetail: null });
    } else {
      items.update(db, item.id, { issues: [], issueDetail: null });
    }
  }
}

/** Copies the sample photo to `${UPLOADS_DIR}/<shopId>/demo-marigold-bakehouse.jpg`; returns the path stored on the shop (relative to UPLOADS_DIR). */
function ensurePhoto(uploadsDir: string, shopId: string): string {
  const rel = `${shopId}/${DEMO_PHOTO}`;
  const dest = path.resolve(uploadsDir, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(PHOTO), dest);
  }
  return rel;
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const cancelUnpaid = process.argv.includes('--cancel-unpaid');
  const cfg = getConfig();
  let payeeEmail: string | null = null;
  if (cfg.sellerEmail !== null) {
    const parsed = parsePayeeEmail(cfg.sellerEmail);
    // Names the variable, never its value.
    if (!parsed.ok) throw new ConfigError('PAYPAL_SANDBOX_SELLER_EMAIL is not an email address. Fix it in .env, or remove it to pay the demo shop to the platform account.');
    payeeEmail = parsed.email;
  }
  // Imported here so tests and Playwright can import seedDemoShop without PayPal credentials.
  const { getPayPal } = await import('@/lib/paypal');
  const result = await seedDemoShop({
    db: getDb(), paypal: getPayPal(), uploadsDir: cfg.uploadsDir, reset, cancelUnpaid, payeeEmail, log: (l) => console.log(l),
  });
  const { shop } = result;
  const live = items.listWithVariants(getDb(), shop.id).filter((i) => i.status === 'live');
  console.log('');
  console.log(`${shop.name} is ${shop.status}: ${live.length} items in the PayPal sandbox catalog${result.published ? ` (${result.published} published now)` : ''}.`);
  if (result.failed.length) {
    console.log(`${result.failed.length} item${result.failed.length === 1 ? '' : 's'} didn't reach PayPal. Run \`npm run seed\` again to retry ${result.failed.length === 1 ? 'it' : 'them'}.`);
    process.exitCode = 1;
  }
  if (live.some((i) => i.paypalProductId?.startsWith('PROD-FAKE'))) {
    console.log('Warning: this shop was seeded for tests with fake PayPal products. Run `npm run seed -- --reset` to publish it to the sandbox.');
  }
  if (result.cancelled) console.log(`Cancelled ${result.cancelled} order${result.cancelled === 1 ? '' : 's'} that ${result.cancelled === 1 ? 'was' : 'were'} waiting for payment.`);
  if (result.unpaid) {
    console.log(`${result.unpaid} order${result.unpaid === 1 ? ' is' : 's are'} waiting for payment. One caller can hold 3 unpaid orders per shop, so before recording run \`npm run seed -- --cancel-unpaid\`.`);
  }
  console.log(
    result.payee.kind === 'seller'
      ? `  Paid to:           the sandbox seller's own PayPal account (${result.payee.maskedEmail}, PAYPAL_SANDBOX_SELLER_EMAIL)`
      : "  Paid to:           Shelfie's own sandbox account (the app's). Set PAYPAL_SANDBOX_SELLER_EMAIL to pay a sandbox seller instead.",
  );
  console.log(`  Shop:              ${cfg.appUrl}/s/${shop.slug}`);
  console.log(`  Agent door (MCP):  ${cfg.appUrl}/s/${shop.slug}/mcp`);
  console.log(`  Order with an AI:  ${cfg.appUrl}/s/${shop.slug}?assistant=1`);
  if (result.ownerToken) {
    console.log(`  Owner link:        ${cfg.appUrl}/claim/${result.ownerToken}`);
    console.log('  (Shown once. It opens the dashboard on any device.)');
  } else {
    console.log('  Owner link:        printed when the shop was created. `npm run seed -- --reset` recreates the shop with a new one.');
  }
}

if (process.argv[1] && /seed-demo\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof ConfigError ? e.message : e instanceof Error ? `Seeding failed: ${e.message}` : e);
    process.exit(1);
  });
}
