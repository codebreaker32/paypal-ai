// npm run seed [-- --reset]
// Creates the demo shop "Marigold Bakehouse" from the recorded menu reading, resolves its review issues as a seller
// would, publishes its items to the real PayPal sandbox catalog, and marks it live. Idempotent: a second run reuses
// the shop and only publishes what is missing. --reset deletes the shop (and its orders) and starts again.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeExtraction } from '@/lib/ai/normalize';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { ConfigError, getConfig } from '@/lib/config';
import { getDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';
import { categoryFor } from '@/lib/paypal/categories';
import type { PayPalPort } from '@/lib/paypal/types';

config({ quiet: true });

export const DEMO_SHOP = {
  name: 'Marigold Bakehouse',
  slug: 'marigold-bakehouse',
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
  published: number;
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

  shop = shops.update(db, shop.id, { menuPhotoPaths: [ensurePhoto(uploadsDir, shop.id)] });
  const published = await publishItems(db, opts.paypal, shop, log);
  if (shop.status === 'draft') shop = shops.publish(db, shop.id);
  return { shop, ownerToken, created, published };
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

const publishable = (i: ItemWithVariants) =>
  i.status === 'draft' && !i.paypalProductId && !i.issues.length && i.variants.some((v) => v.priceCents !== null && v.priceCents > 0);

/**
 * Publishes every ready item to the PayPal catalog (3 at a time, PayPal-Request-Id `pub-<itemId>` so a retry never
 * makes a second product) and marks it live. Task 6's publishShop replaces this function.
 */
export async function publishItems(db: Db, paypal: PayPalPort, shop: Shop, log: (line: string) => void = () => {}): Promise<number> {
  const ready = items.listWithVariants(db, shop.id).filter(publishable);
  const category = categoryFor(shop.kind);
  let done = 0;
  for (let i = 0; i < ready.length; i += 3) {
    await Promise.all(
      ready.slice(i, i + 3).map(async (item) => {
        const { id } = await paypal.createProduct(
          { name: item.name, type: item.kind, ...(item.description ? { description: item.description } : {}), ...(category ? { category } : {}) },
          `pub-${item.id}`,
        );
        items.setPayPalProductId(db, item.id, id);
        done++;
        log(`  PayPal product ${id}  ${item.name}`);
      }),
    );
  }
  return done;
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
