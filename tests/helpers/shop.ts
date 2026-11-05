// Test fixture: a published Marigold Bakehouse shop with a realistic menu.
import type { Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import type { DraftItem, ItemWithVariants, Shop, ShopFulfillment, ShopStatus } from '@/lib/domain/types';

const draft = (name: string, prices: (number | null)[], extra: Partial<DraftItem> = {}): DraftItem => ({
  section: null, name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: prices.length > 1 ? ['S', 'L', 'XL'][i] : null, priceCents: p })),
  ...extra,
});

export interface SeedOpts {
  name?: string;
  fulfillment?: ShopFulfillment;
  shippingFeeCents?: number;
  status?: ShopStatus;
  orderCapCents?: number;
}

export interface SeededShop {
  shop: Shop;
  /** Items by name (fresh from the DB after publishing). */
  item: Record<string, ItemWithVariants>;
}

/**
 * Live shop: Almond croissant $4.75 (Pastries), Butter croissant $4.25 (Pastries), Drip coffee S $3.00 / L $4.00 (Drinks),
 * Sourdough loaf $9.00 (Bread), Seeded rye $10.50 (Bread, sold out), Market fish (in person, no price),
 * Old scone (removed), Secret menu (draft, never published).
 */
export function seedShop(db: Db, opts: SeedOpts = {}): SeededShop {
  const { shop } = shops.create(db, {
    name: opts.name ?? 'Marigold Bakehouse',
    about: 'Weekend bakes from a home kitchen in Austin.',
    fulfillment: opts.fulfillment ?? 'both',
    shippingFeeCents: opts.shippingFeeCents ?? 800,
    pickupNotes: 'Saturday 8–12 at the Mueller farmers market',
  });
  const created = items.replaceDrafts(db, shop.id, [
    draft('Almond croissant', [475], { section: 'Pastries', description: 'Flaky, with almond cream. Contains nuts.' }),
    draft('Butter croissant', [425], { section: 'Pastries' }),
    draft('Drip coffee', [300, 400], { section: 'Drinks' }),
    draft('Sourdough loaf', [900], { section: 'Bread' }),
    draft('Seeded rye', [1050], { section: 'Bread' }),
    draft('Market fish', [null], { section: 'Other', status: 'in_person', issues: ['MARKET_PRICE'] }),
    draft('Old scone', [350], { section: 'Pastries', status: 'removed' }),
    draft('Secret menu', [100], { section: 'Other' }),
  ]);
  let n = 0;
  for (const it of created) {
    if (['Market fish', 'Old scone', 'Secret menu'].includes(it.name)) continue;
    items.setPayPalProductId(db, it.id, `PROD-${shop.id.slice(4, 10)}-${++n}`);
  }
  const rye = created.find((i) => i.name === 'Seeded rye')!;
  items.update(db, rye.id, { soldOut: true });
  shops.publish(db, shop.id);
  const patch: shops.ShopPatch = {};
  if (opts.status && opts.status !== 'live') patch.status = opts.status;
  if (opts.orderCapCents !== undefined) patch.orderCapCents = opts.orderCapCents;
  const final = shops.update(db, shop.id, patch);
  const item = Object.fromEntries(items.listWithVariants(db, shop.id).map((i) => [i.name, i]));
  return { shop: final, item };
}
