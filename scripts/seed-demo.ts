// npm run seed [-- --reset | --cancel-unpaid]
// Publishes Marigold Bakehouse and the other seeded shops (src/lib/demo/shops.ts, `seedSellerShop` below; those need
// PAYPAL_SANDBOX_SELLER_EMAIL, which pays them, and are skipped without it). --reset and --cancel-unpaid apply to all.
// Marigold: created from the recorded menu reading, resolves its review issues as a seller
// would, gives it the bundled cover and item photos (public/demo/marigold-bakehouse), publishes its items to the real
// PayPal sandbox catalog with the setup flow's own publishShop, and marks it live. Idempotent: a second run reuses the shop and only publishes what is missing (an item PayPal turned down last
// time, say). --reset deletes the shop (and its orders) and starts again. Every run reports the demo shop's orders still
// waiting for payment (one caller can hold 3); --cancel-unpaid cancels them before a recording.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeExtraction } from '@/lib/ai/normalize';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { RESERVED_SLUG, publishShop, type PublishResult } from '@/lib/catalog/publish';
import { ConfigError, getConfig } from '@/lib/config';
import { recordedReading, samplePhotoPath } from '@/lib/ai/samples';
import { demoCoverFor, demoPhotoFor } from '@/lib/demo/photos';
import { SEED_SHOPS, type SeedShopDef } from '@/lib/demo/shops';
import { maskEmail, parsePayeeEmail } from '@/lib/domain/payee';
import { getDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import type { DraftItem, Shop } from '@/lib/domain/types';
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
  /** Its Browse chip (src/lib/demo/shops.ts). */
  category: 'food',
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
  let shop = shops.bySlug(db, DEMO_SHOP.slug);
  // Never adopt, change or delete a shop the seed didn't make (one published before the slug was reserved).
  if (shop && !isSeedShop(shop)) {
    throw new Error(
      `${DEMO_SHOP.slug} belongs to ${shop.name} (${shop.id}), which is not the demo shop: the seed didn't create it, so it leaves it alone. ` +
        'Use a fresh DATABASE_PATH for the demo shop.',
    );
  }

  if (shop && opts.reset) {
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
  }

  const shopId = shop.id;
  const payeeEmail = opts.payeeEmail ?? null;
  // Every run follows the env var: a changed or removed PAYPAL_SANDBOX_SELLER_EMAIL changes where new orders are paid.
  shops.update(db, shopId, { menuPhotoPaths: [ensurePhoto(uploadsDir, shopId)], payeeEmail, category: DEMO_SHOP.category });
  applyDemoPhotos(db, shopId, DEMO_SHOP.slug);
  // The setup flow's own publish: same products, same request ids, and it makes the shop live.
  const result = await publishQuietly(opts, shopId);
  const cancelled = opts.cancelUnpaid ? await cancelUnpaidOrders(opts, shopId) : 0;
  return {
    shop: shops.byId(db, shopId)!, ownerToken, created, published: result.published, failed: result.failed,
    unpaid: waitingOrders(db, shopId), cancelled,
    payee: payeeEmail ? { kind: 'seller', maskedEmail: maskEmail(payeeEmail) } : { kind: 'platform' },
  };
}

/** The setup flow's own publish (same products, same request ids; it makes the shop live), logging only refusals. */
function publishQuietly(opts: SeedOptions, shopId: string): Promise<PublishResult> {
  const { db } = opts;
  const log = opts.log ?? (() => {});
  return publishShop({ db, paypal: opts.paypal }, shopId, (e) => {
    if (e.ok) return;
    log(`  Not added: ${items.byIdForShop(db, shopId, e.itemId)?.name ?? e.itemId}: ${e.message}`);
  });
}

/** Orders still waiting for buyer approval; ones past their expiry no longer hold a caller's unpaid-order cap. */
function waitingOrders(db: Db, shopId: string): number {
  return orders.listByShop(db, shopId, { status: ['awaiting_approval'] }).filter((o) => Date.parse(o.expiresAt) > Date.now()).length;
}

/** Cancels the shop's orders still waiting for buyer approval (rehearsal orders); returns how many. */
async function cancelUnpaidOrders(opts: SeedOptions, shopId: string): Promise<number> {
  const { db } = opts;
  const deps = { db, paypal: opts.paypal, appUrl: getConfig().appUrl };
  let cancelled = 0;
  for (const o of orders.listByShop(db, shopId, { status: ['awaiting_approval'] })) {
    // Ask PayPal first: a buyer who approved a moment ago is captured, not cancelled.
    const synced = await syncOrder(deps, o.id, 'poller').catch(() => o);
    if (synced.status !== 'awaiting_approval') continue;
    if ((await cancelOrder(deps, o.id, 'seller')).status === 'cancelled') cancelled++;
  }
  return cancelled;
}

export interface SellerSeedResult {
  def: SeedShopDef;
  /** Null when skipped: no PAYPAL_SANDBOX_SELLER_EMAIL, so nothing could pay it (only Marigold may be platform-paid). */
  shop: Shop | null;
  ownerToken: string | null;
  created: boolean;
  published: number;
  failed: PublishResult['failed'];
  unpaid: number;
  cancelled: number;
}

/** The items a seller would type for a written-out shop, or the recorded reading of its sample menu, resolved. */
function draftsFor(def: SeedShopDef): DraftItem[] {
  if ('sample' in def.menu) {
    const catalog = normalizeExtraction(recordedReading(def.menu.sample));
    if ('unreadable' in catalog) throw new Error(`The recorded reading for ${def.name} is unreadable: ${catalog.reason}`);
    return catalog.items;
  }
  return def.menu.items.map((i) => ({
    section: i.section, name: i.name, description: i.description, sourceText: i.name, confidence: 'high', kind: def.kind === 'services' ? 'SERVICE' : 'PHYSICAL',
    issues: [], issueDetail: null, status: 'draft', category: i.category, examplePhoto: null,
    variants: i.prices.map((p) => ({ label: p.label, priceCents: p.cents })),
  }));
}

/**
 * One of the other seeded shops (src/lib/demo/shops.ts), made and published like Marigold: it is found again by its
 * seed key (never by slug, so a visitor's shop of the same name is never touched), paid to `payeeEmail`, and given its
 * bundled photos and Browse category on every run. Without a payee email it is skipped: only Marigold may be paid to
 * the platform account (spec §8a), so an existing seeded shop is left as it was.
 */
export async function seedSellerShop(def: SeedShopDef, opts: SeedOptions): Promise<SellerSeedResult> {
  const { db, uploadsDir } = opts;
  const payeeEmail = opts.payeeEmail ?? null;
  const none = { def, shop: null, ownerToken: null, created: false, published: 0, failed: [], unpaid: 0, cancelled: 0 };
  let shop = shops.bySeedKey(db, def.key);
  if (shop && opts.reset) {
    db.prepare('DELETE FROM shops WHERE id = ?').run(shop.id);
    fs.rmSync(path.join(uploadsDir, shop.id), { recursive: true, force: true });
    shop = null;
  }
  if (!payeeEmail) return none;

  let ownerToken: string | null = null;
  const created = !shop;
  if (!shop) {
    const made = shops.create(db, {
      name: def.name, about: def.about, kind: def.kind, fulfillment: def.fulfillment, pickupNotes: def.pickupNotes,
      shippingFeeCents: def.shippingFeeCents, payeeEmail,
    });
    shop = made.shop;
    ownerToken = made.ownerToken;
    shops.setSeedKey(db, shop.id, def.key);
    items.replaceDrafts(db, shop.id, draftsFor(def));
    resolveLikeASeller(db, shop.id);
  }
  const shopId = shop.id;
  const menuPhotoPaths = 'sample' in def.menu ? [copyOnce(uploadsDir, `${shopId}/seed-${def.menu.sample}.jpg`, samplePhotoPath(def.menu.sample))] : shop.menuPhotoPaths;
  shops.update(db, shopId, { payeeEmail, category: def.category, menuPhotoPaths });
  applyDemoPhotos(db, shopId, def.photos);
  const result = await publishQuietly(opts, shopId);
  const cancelled = opts.cancelUnpaid ? await cancelUnpaidOrders(opts, shopId) : 0;
  return { def, shop: shops.byId(db, shopId)!, ownerToken, created, published: result.published, failed: result.failed, unpaid: waitingOrders(db, shopId), cancelled };
}

/** Marigold, then every other seeded shop. */
export async function seedAllShops(opts: SeedOptions): Promise<{ marigold: SeedResult; others: SellerSeedResult[] }> {
  const marigold = await seedDemoShop(opts);
  const others: SellerSeedResult[] = [];
  for (const def of SEED_SHOPS) others.push(await seedSellerShop(def, opts));
  return { marigold, others };
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

/**
 * The bundled cover and item photos (src/lib/demo/photos.ts) on every run. A photo the seller uploaded (an /i/ URL)
 * is kept; an empty one or an older bundled one is set.
 */
function applyDemoPhotos(db: Db, shopId: string, photoSet: string): void {
  const replaceable = (url: string | null) => url === null || url.startsWith('/demo/');
  const shop = shops.byId(db, shopId)!;
  const cover = demoCoverFor(photoSet);
  if (replaceable(shop.coverUrl) && shop.coverUrl !== cover) shops.update(db, shopId, { coverUrl: cover });
  for (const item of items.listWithVariants(db, shopId)) {
    const photo = demoPhotoFor(photoSet, item.name);
    if (photo && replaceable(item.photoUrl) && item.photoUrl !== photo) items.update(db, item.id, { photoUrl: photo });
  }
}

/** Copies the sample photo to `${UPLOADS_DIR}/<shopId>/demo-marigold-bakehouse.jpg`; returns the path stored on the shop (relative to UPLOADS_DIR). */
function ensurePhoto(uploadsDir: string, shopId: string): string {
  return copyOnce(uploadsDir, `${shopId}/${DEMO_PHOTO}`, path.resolve(PHOTO));
}

/** Copies `src` to `${uploadsDir}/<rel>` unless it is there; returns `rel`. */
function copyOnce(uploadsDir: string, rel: string, src: string): string {
  const dest = path.resolve(uploadsDir, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
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
  const db = getDb();
  const { marigold, others } = await seedAllShops({
    db, paypal: getPayPal(), uploadsDir: cfg.uploadsDir, reset, cancelUnpaid, payeeEmail, log: (l) => console.log(l),
  });
  const rows = [
    { name: marigold.shop.name, shop: marigold.shop as Shop | null, created: marigold.created, token: marigold.ownerToken, published: marigold.published, failed: marigold.failed.length, unpaid: marigold.unpaid, cancelled: marigold.cancelled },
    ...others.map((o) => ({ name: o.def.name, shop: o.shop, created: o.created, token: o.ownerToken, published: o.published, failed: o.failed.length, unpaid: o.unpaid, cancelled: o.cancelled })),
  ];
  const width = Math.max(...rows.map((r) => r.name.length));
  let failed = 0;
  let unpaid = 0;
  let fake = false;
  for (const r of rows) {
    if (!r.shop) {
      console.log(`${r.name.padEnd(width)}  skipped: set PAYPAL_SANDBOX_SELLER_EMAIL to publish it`);
      continue;
    }
    const live = items.listWithVariants(db, r.shop.id).filter((i) => i.status === 'live');
    fake ||= live.some((i) => i.paypalProductId?.startsWith('PROD-FAKE'));
    failed += r.failed;
    unpaid += r.unpaid;
    const notes = [r.created ? 'created' : '', r.published ? `${r.published} published now` : '', r.failed ? `${r.failed} not added` : '', r.cancelled ? `${r.cancelled} unpaid cancelled` : '']
      .filter(Boolean).join(', ');
    console.log(`${r.name.padEnd(width)}  ${r.shop.status}, ${live.length} items in PayPal  ${cfg.appUrl}/s/${r.shop.slug}${notes ? `  (${notes})` : ''}`);
  }
  console.log('');
  if (failed) {
    console.log(`${failed} item${failed === 1 ? '' : 's'} didn't reach PayPal. Run \`npm run seed\` again to retry.`);
    process.exitCode = 1;
  }
  if (fake) console.log('Warning: some shops were seeded for tests with fake PayPal products. Run `npm run seed -- --reset` to publish them to the sandbox.');
  if (unpaid) console.log(`${unpaid} order${unpaid === 1 ? ' is' : 's are'} waiting for payment. One caller can hold 3 unpaid orders per shop, so before recording run \`npm run seed -- --cancel-unpaid\`.`);
  console.log(
    marigold.payee.kind === 'seller'
      ? `Paid to: the sandbox seller's own PayPal account (${marigold.payee.maskedEmail}, PAYPAL_SANDBOX_SELLER_EMAIL)`
      : "Paid to: Shelfie's own sandbox account (Marigold only). Set PAYPAL_SANDBOX_SELLER_EMAIL to pay a sandbox seller and publish the other shops.",
  );
  console.log(`Agent door (MCP): ${cfg.appUrl}/s/<slug>/mcp · order with an AI: ${cfg.appUrl}/s/<slug>?assistant=1`);
  const links = rows.filter((r) => r.token);
  if (links.length) {
    console.log('Owner links (shown once; each opens that shop\'s dashboard on any device):');
    for (const r of links) console.log(`  ${r.name.padEnd(width)}  ${cfg.appUrl}/claim/${r.token}`);
  } else {
    console.log('Owner links: printed when each shop was created. `npm run seed -- --reset` recreates the shops with new ones.');
  }
}

if (process.argv[1] && /seed-demo\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof ConfigError ? e.message : e instanceof Error ? `Seeding failed: ${e.message}` : e);
    process.exit(1);
  });
}
