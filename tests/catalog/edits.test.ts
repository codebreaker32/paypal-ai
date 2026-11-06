import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import type { DraftItem } from '@/lib/domain/types';
import { EditError, addItem, applyItemUpdates, applyShopPatch, parseItemUpdates, parseNewItem, parseShopPatch } from '@/lib/catalog/edits';

const draft = (name: string, prices: (number | null)[], extra: Partial<DraftItem> = {}): DraftItem => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p })),
  ...extra,
});

function errorOf(fn: () => unknown): { code: string; status: number } | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof EditError) return { code: e.code, status: e.status };
    throw e;
  }
}

describe('edits', () => {
  let db: Database.Database;
  let shopId: string;
  let ids: Record<string, string>;

  beforeEach(() => {
    db = createTestDb();
    shopId = shops.create(db, { name: 'Marigold' }).shop.id;
    const list = items.replaceDrafts(db, shopId, [
      draft('Butter croissant', [425]),
      draft('Pain au chocolat', [null], { issues: ['MISSING_PRICE'] }),
      draft('Galette', [null], { issues: ['MARKET_PRICE'], status: 'in_person' }),
      draft('Drip coffee', [300, 400]),
    ]);
    ids = Object.fromEntries(list.map((i) => [i.name, i.id]));
  });

  describe('shop details', () => {
    it('validates and saves details, trimming text', () => {
      const patch = parseShopPatch({ name: '  Rosa Bakes ', about: 'Weekend loaves', fulfillment: 'both', shippingFeeCents: 800 });
      const shop = applyShopPatch(db, shops.byId(db, shopId)!, patch);
      expect(shop).toMatchObject({ name: 'Rosa Bakes', about: 'Weekend loaves', fulfillment: 'both', shippingFeeCents: 800 });
    });

    it('rejects unknown keys, an empty name and bad fees', () => {
      expect(errorOf(() => parseShopPatch({ slug: 'x' }))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseShopPatch({ name: '   ' }))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseShopPatch({ shippingFeeCents: 8.5 }))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseShopPatch({ shippingFeeCents: -1 }))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseShopPatch({ shippingFeeCents: 100001 }))?.code).toBe('INVALID_REQUEST');
    });

    it('accepts a $0 shipping fee (free shipping)', () => {
      expect(parseShopPatch({ shippingFeeCents: 0 }).shippingFeeCents).toBe(0);
    });

    it('only toggles live and paused on a published shop', () => {
      const draftShop = shops.byId(db, shopId)!;
      expect(errorOf(() => applyShopPatch(db, draftShop, parseShopPatch({ status: 'live' })))).toEqual({ code: 'NOT_PUBLISHED', status: 409 });
      shops.publish(db, shopId);
      const paused = applyShopPatch(db, shops.byId(db, shopId)!, parseShopPatch({ status: 'paused' }));
      expect(paused.status).toBe('paused');
      expect(applyShopPatch(db, paused, parseShopPatch({ status: 'live' })).status).toBe('live');
      expect(errorOf(() => parseShopPatch({ status: 'draft' }))?.code).toBe('INVALID_REQUEST');
    });
  });

  describe('item updates', () => {
    it('sets a price in cents and clears the issues when asked', () => {
      const out = applyItemUpdates(db, shopId, parseItemUpdates({
        updates: [{ itemId: ids['Pain au chocolat'], variants: [{ label: null, priceCents: 475 }], resolveIssues: true }],
      }));
      const pain = out.find((i) => i.id === ids['Pain au chocolat'])!;
      expect(pain.issues).toEqual([]);
      expect(pain.variants.map((v) => v.priceCents)).toEqual([475]);
      // Returns the whole menu so callers can replace their list.
      expect(out).toHaveLength(4);
    });

    it('clears only the "listed twice" flag when asked, so an item keeps its own question', () => {
      const [big] = items.replaceDrafts(db, shopId, [
        draft('Gift box', [150_000], { issues: ['CHECK', 'DUPLICATE'], issueDetail: 'We set $1500.00, which looks unusual. Is that right?' }),
      ]);
      const out = applyItemUpdates(db, shopId, parseItemUpdates({ updates: [{ itemId: big.id, resolveDuplicate: true }] }));
      expect(out.find((i) => i.id === big.id)).toMatchObject({ issues: ['CHECK'], issueDetail: 'We set $1500.00, which looks unusual. Is that right?' });
    });

    it('moves an "ask in person" item back to the menu with today\'s price', () => {
      applyItemUpdates(db, shopId, parseItemUpdates({
        updates: [{ itemId: ids.Galette, status: 'draft', variants: [{ label: null, priceCents: 2400 }], resolveIssues: true }],
      }));
      const g = items.byIdForShop(db, shopId, ids.Galette)!;
      expect(g).toMatchObject({ status: 'draft', issues: [] });
      expect(g.variants[0].priceCents).toBe(2400);
    });

    it('applies several updates together, or none if one is bad', () => {
      const bad = { updates: [{ itemId: ids['Butter croissant'], name: 'Croissant' }, { itemId: 'itm_nope', name: 'x' }] };
      expect(errorOf(() => applyItemUpdates(db, shopId, parseItemUpdates(bad)))).toEqual({ code: 'ITEM_NOT_FOUND', status: 404 });
      expect(items.byIdForShop(db, shopId, ids['Butter croissant'])!.name).toBe('Butter croissant');
    });

    it("never touches another shop's item", () => {
      const other = shops.create(db, { name: 'Other' }).shop.id;
      const [theirs] = items.replaceDrafts(db, other, [draft('Theirs', [100])]);
      const req = parseItemUpdates({ updates: [{ itemId: theirs.id, status: 'removed' }] });
      expect(errorOf(() => applyItemUpdates(db, shopId, req))?.code).toBe('ITEM_NOT_FOUND');
      expect(items.byIdForShop(db, other, theirs.id)!.status).toBe('draft');
    });

    it('validates prices as whole cents from 1 cent to $500 (the online order cap)', () => {
      const up = (priceCents: unknown) => ({ updates: [{ itemId: ids['Butter croissant'], variants: [{ label: null, priceCents }] }] });
      expect(errorOf(() => parseItemUpdates(up(0)))?.code).toBe('INVALID_REQUEST');
      expect(parseItemUpdates(up(1)).updates[0].variants![0].priceCents).toBe(1);
      expect(parseItemUpdates(up(null)).updates[0].variants![0].priceCents).toBeNull();
      expect(errorOf(() => parseItemUpdates(up(4.5)))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseItemUpdates(up(-1)))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseItemUpdates(up(50_001)))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseItemUpdates(up('4.50')))?.code).toBe('INVALID_REQUEST');
      expect(parseItemUpdates(up(50_000)).updates[0].variants![0].priceCents).toBe(50_000);
      expect(errorOf(() => parseItemUpdates({ updates: [{ itemId: ids['Butter croissant'], price: 1 }] }))?.code).toBe('INVALID_REQUEST');
      expect(errorOf(() => parseItemUpdates({ updates: [] }))?.code).toBe('INVALID_REQUEST');
    });

    it('lets a live item be marked sold out or removed, but not renamed or repriced', () => {
      items.setPayPalProductId(db, ids['Butter croissant'], 'PROD-1');
      const out = applyItemUpdates(db, shopId, parseItemUpdates({ updates: [{ itemId: ids['Butter croissant'], soldOut: true }] }));
      expect(out.find((i) => i.id === ids['Butter croissant'])!.soldOut).toBe(true);
      const rename = parseItemUpdates({ updates: [{ itemId: ids['Butter croissant'], name: 'Croissant' }] });
      expect(errorOf(() => applyItemUpdates(db, shopId, rename))).toEqual({ code: 'ITEM_LIVE', status: 409 });
      const reprice = parseItemUpdates({ updates: [{ itemId: ids['Butter croissant'], variants: [{ label: null, priceCents: 1 }] }] });
      expect(errorOf(() => applyItemUpdates(db, shopId, reprice))?.code).toBe('ITEM_LIVE');
    });
  });

  describe('making a skipped line an item', () => {
    it('adds a priced item at the end of the menu, ready to publish', () => {
      const item = addItem(db, shopId, parseNewItem({ name: 'Add guac', priceCents: 150, sourceText: '+$1.5 add guac', section: 'Extras' }));
      expect(item).toMatchObject({ name: 'Add guac', issues: [], status: 'draft', section: 'Extras', sourceText: '+$1.5 add guac', kind: 'PHYSICAL' });
      expect(item.variants).toMatchObject([{ label: null, priceCents: 150 }]);
      expect(items.listWithVariants(db, shopId).at(-1)!.id).toBe(item.id);
    });

    it('turns down a $0 price', () => {
      expect(errorOf(() => parseNewItem({ name: 'Free refill', priceCents: 0, sourceText: 'Free refill $0' }))?.code).toBe('INVALID_REQUEST');
    });

    it('flags an item added without a price', () => {
      const item = addItem(db, shopId, parseNewItem({ name: 'Day-old bread', sourceText: 'Day-old bread' }));
      expect(item.issues).toEqual(['MISSING_PRICE']);
      expect(item.variants[0].priceCents).toBeNull();
    });

    it('uses SERVICE items for a services shop', () => {
      const ravi = shops.create(db, { name: 'Ravi', kind: 'services' }).shop.id;
      expect(addItem(db, ravi, parseNewItem({ name: 'Tube', priceCents: 800, sourceText: 'Tube $8' })).kind).toBe('SERVICE');
    });
  });
});
