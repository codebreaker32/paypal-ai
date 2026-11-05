// npm run seed [-- --reset]
// Creates the demo shop "Marigold Bakehouse" from the recorded menu reading, resolves its review issues as a seller
// would, publishes its items to the real PayPal sandbox catalog with the setup flow's own publishShop, and marks it
// live. Idempotent: a second run reuses the shop and only publishes what is missing (an item PayPal turned down last
// time, say). --reset deletes the shop (and its orders) and starts again.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeExtraction } from '@/lib/ai/normalize';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { RESERVED_SLUG, publishShop, type PublishResult } from '@/lib/catalog/publish';
import { ConfigError, getConfig } from '@/lib/config';
import { getDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import type { Shop } from '@/lib/domain/types';
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

export interface SeedOptions {
  db: Db;
  paypal: PayPalPort;
  uploadsDir: string;
  reset?: boolean;
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
}

export async function seedDemoShop(opts: SeedOptions): Promise<SeedResult> {
  const { db, uploadsDir } = opts;
  const log = opts.log ?? (() => {});
  let shop = shops.bySlug(db, DEMO_SHOP.slug);

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
  shops.update(db, shopId, { menuPhotoPaths: [ensurePhoto(uploadsDir, shopId)] });
  // The setup flow's own publish: same products, same request ids, and it makes the shop live.
  const result = await publishShop({ db, paypal: opts.paypal }, shopId, (e) => {
    const name = items.byIdForShop(db, shopId, e.itemId)?.name ?? e.itemId;
    log(e.ok ? `  PayPal product ${e.paypalProductId}  ${name}` : `  Not added: ${name}: ${e.message}`);
  });
  return { shop: shops.byId(db, shopId)!, ownerToken, created, published: result.published, failed: result.failed };
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

/** Copies the sample photo to `${UPLOADS_DIR}/<shopId>/page-1.jpg`; returns the path stored on the shop (relative to UPLOADS_DIR). */
function ensurePhoto(uploadsDir: string, shopId: string): string {
  const rel = `${shopId}/page-1.jpg`;
  const dest = path.resolve(uploadsDir, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(PHOTO), dest);
  }
  return rel;
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const cfg = getConfig();
  // Imported here so tests and Playwright can import seedDemoShop without PayPal credentials.
  const { getPayPal } = await import('@/lib/paypal');
  const result = await seedDemoShop({ db: getDb(), paypal: getPayPal(), uploadsDir: cfg.uploadsDir, reset, log: (l) => console.log(l) });
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
