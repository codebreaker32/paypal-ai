import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import { priceOrder, ORDER_LIMITS } from '@/lib/orders/pricing';
import { OrderError } from '@/lib/orders/errors';
import { seedShop, type SeededShop } from '../helpers/shop';

function orderError(fn: () => unknown): OrderError {
  try {
    fn();
  } catch (e) {
    if (e instanceof OrderError) return e;
    throw e;
  }
  throw new Error('expected an OrderError');
}

describe('priceOrder', () => {
  let db: Db;
  let s: SeededShop;
  beforeEach(() => {
    db = createTestDb();
    s = seedShop(db);
  });

  it('prices lines from the database and snapshots name, option and PayPal product', () => {
    const almond = s.item['Almond croissant'];
    const coffee = s.item['Drip coffee'];
    const p = priceOrder(db, s.shop, [
      { itemId: almond.id, quantity: 2 },
      { itemId: coffee.id, optionId: coffee.variants[1].id, quantity: 1 },
    ], 'pickup');
    expect(p.fulfillment).toBe('pickup');
    expect(p.itemsCents).toBe(2 * 475 + 400);
    expect(p.shippingCents).toBe(0);
    expect(p.totalCents).toBe(1350);
    expect(p.lines).toEqual([
      { itemId: almond.id, variantId: almond.variants[0].id, name: 'Almond croissant', label: null, unitCents: 475, qty: 2, paypalProductId: almond.paypalProductId, kind: 'PHYSICAL' },
      { itemId: coffee.id, variantId: coffee.variants[1].id, name: 'Drip coffee', label: 'L', unitCents: 400, qty: 1, paypalProductId: coffee.paypalProductId, kind: 'PHYSICAL' },
    ]);
  });

  it('adds the flat shipping fee once, however many lines', () => {
    const p = priceOrder(db, s.shop, [
      { itemId: s.item['Almond croissant'].id, quantity: 2 },
      { itemId: s.item['Sourdough loaf'].id, quantity: 1 },
      { itemId: s.item['Butter croissant'].id, quantity: 3 },
    ], 'shipping');
    expect(p.itemsCents).toBe(950 + 900 + 1275);
    expect(p.shippingCents).toBe(800);
    expect(p.totalCents).toBe(950 + 900 + 1275 + 800);
  });

  it('uses the only mode a single-mode shop offers by default', () => {
    const pickupOnly = seedShop(db, { name: 'Pickup Only', fulfillment: 'pickup' });
    const shipOnly = seedShop(db, { name: 'Ship Only', fulfillment: 'shipping', shippingFeeCents: 500 });
    const a = priceOrder(db, pickupOnly.shop, [{ itemId: pickupOnly.item['Sourdough loaf'].id, quantity: 1 }], undefined);
    expect(a.fulfillment).toBe('pickup');
    expect(a.shippingCents).toBe(0);
    const b = priceOrder(db, shipOnly.shop, [{ itemId: shipOnly.item['Sourdough loaf'].id, quantity: 1 }], undefined);
    expect(b.fulfillment).toBe('shipping');
    expect(b.totalCents).toBe(1400);
  });

  it('requires a fulfillment choice when the shop offers pickup and shipping', () => {
    const e = orderError(() => priceOrder(db, s.shop, [{ itemId: s.item['Sourdough loaf'].id, quantity: 1 }], undefined));
    expect(e.code).toBe('FULFILLMENT_REQUIRED');
    expect(e.details?.modes).toEqual(['pickup', 'shipping']);
    expect(e.hint).toBeTruthy();
  });

  it('rejects a mode the shop does not offer and lists what it does offer', () => {
    const pickupOnly = seedShop(db, { name: 'Pickup Only', fulfillment: 'pickup' });
    const e = orderError(() => priceOrder(db, pickupOnly.shop, [{ itemId: pickupOnly.item['Sourdough loaf'].id, quantity: 1 }], 'shipping'));
    expect(e.code).toBe('FULFILLMENT_REQUIRED');
    expect(e.details?.modes).toEqual(['pickup']);
  });

  it('treats removed, draft, unknown and other-shop items as unknown, with suggestions', () => {
    const other = seedShop(db, { name: 'Other Shop' });
    for (const id of [s.item['Old scone'].id, s.item['Secret menu'].id, 'itm_doesnotexist', other.item['Sourdough loaf'].id]) {
      expect(orderError(() => priceOrder(db, s.shop, [{ itemId: id, quantity: 1 }], 'pickup')).code).toBe('UNKNOWN_ITEM');
    }
    const e = orderError(() => priceOrder(db, s.shop, [{ itemId: 'almond croisant', quantity: 1 }], 'pickup'));
    expect(e.code).toBe('UNKNOWN_ITEM');
    const dym = e.details?.didYouMean as { item_id: string; name: string }[];
    expect(dym[0]).toEqual({ item_id: s.item['Almond croissant'].id, name: 'Almond croissant' });
    expect(dym.length).toBeLessThanOrEqual(3);
    expect(dym.map((d) => d.name)).not.toContain('Old scone');
  });

  it('rejects in-person and sold-out items as unavailable', () => {
    const inPerson = orderError(() => priceOrder(db, s.shop, [{ itemId: s.item['Market fish'].id, quantity: 1 }], 'pickup'));
    expect(inPerson.code).toBe('ITEM_UNAVAILABLE');
    expect(inPerson.message).toMatch(/in person/i);
    const soldOut = orderError(() => priceOrder(db, s.shop, [{ itemId: s.item['Seeded rye'].id, quantity: 1 }], 'pickup'));
    expect(soldOut.code).toBe('ITEM_UNAVAILABLE');
    expect(soldOut.message).toMatch(/sold out/i);
  });

  it('rejects an option with no price', () => {
    const loaf = s.item['Sourdough loaf'];
    items.updateVariant(db, loaf.variants[0].id, { priceCents: null });
    expect(orderError(() => priceOrder(db, s.shop, [{ itemId: loaf.id, quantity: 1 }], 'pickup')).code).toBe('ITEM_UNAVAILABLE');
  });

  it('requires an option when the item has several, and lists them', () => {
    const coffee = s.item['Drip coffee'];
    const e = orderError(() => priceOrder(db, s.shop, [{ itemId: coffee.id, quantity: 1 }], 'pickup'));
    expect(e.code).toBe('OPTION_REQUIRED');
    expect(e.details?.options).toEqual([
      { option_id: coffee.variants[0].id, label: 'S', price: '3.00' },
      { option_id: coffee.variants[1].id, label: 'L', price: '4.00' },
    ]);
    const bad = orderError(() => priceOrder(db, s.shop, [{ itemId: coffee.id, optionId: 'var_nope', quantity: 1 }], 'pickup'));
    expect(bad.code).toBe('OPTION_REQUIRED');
    const foreign = orderError(() =>
      priceOrder(db, s.shop, [{ itemId: coffee.id, optionId: s.item['Almond croissant'].variants[0].id, quantity: 1 }], 'pickup'));
    expect(foreign.code).toBe('OPTION_REQUIRED');
  });

  it('accepts the single option implicitly or explicitly', () => {
    const loaf = s.item['Sourdough loaf'];
    const p = priceOrder(db, s.shop, [{ itemId: loaf.id, optionId: loaf.variants[0].id, quantity: 1 }], 'pickup');
    expect(p.totalCents).toBe(900);
  });

  it('limits quantity per line to 1–20 whole units', () => {
    const id = s.item['Sourdough loaf'].id;
    for (const quantity of [21, 0, -1, 1.5]) {
      expect(orderError(() => priceOrder(db, s.shop, [{ itemId: id, quantity }], 'pickup')).code).toBe('QUANTITY_LIMIT');
    }
    expect(priceOrder(db, s.shop, [{ itemId: id, quantity: 20 }], 'pickup').totalCents).toBe(18000);
  });

  it('limits an order to 15 lines', () => {
    const id = s.item['Butter croissant'].id;
    expect(ORDER_LIMITS.maxLines).toBe(15);
    expect(priceOrder(db, s.shop, Array.from({ length: 15 }, () => ({ itemId: id, quantity: 1 })), 'pickup').lines).toHaveLength(15);
    const e = orderError(() => priceOrder(db, s.shop, Array.from({ length: 16 }, () => ({ itemId: id, quantity: 1 })), 'pickup'));
    expect(e.code).toBe('ORDER_TOO_LARGE');
  });

  it('rejects an empty order', () => {
    expect(orderError(() => priceOrder(db, s.shop, [], 'pickup')).code).toBe('INVALID_ARGUMENTS');
  });

  it('rejects a total over the shop cap (shipping included)', () => {
    const capped = seedShop(db, { name: 'Capped', orderCapCents: 2500 });
    const loaf = capped.item['Sourdough loaf'].id;
    expect(priceOrder(db, capped.shop, [{ itemId: loaf, quantity: 2 }], 'pickup').totalCents).toBe(1800);
    const e = orderError(() => priceOrder(db, capped.shop, [{ itemId: loaf, quantity: 2 }], 'shipping'));
    expect(e.code).toBe('ORDER_TOO_LARGE');
    expect(e.message).toContain('25.00');
    // Default cap is $500.
    const big = orderError(() => priceOrder(db, s.shop, Array.from({ length: 3 }, () => ({ itemId: s.item['Sourdough loaf'].id, quantity: 20 })), 'pickup'));
    expect(big.code).toBe('ORDER_TOO_LARGE');
  });

  it('refuses orders when the shop is paused or still a draft', () => {
    const paused = seedShop(db, { name: 'Paused', status: 'paused' });
    const e = orderError(() => priceOrder(db, paused.shop, [{ itemId: paused.item['Sourdough loaf'].id, quantity: 1 }], 'pickup'));
    expect(e.code).toBe('SHOP_NOT_ACCEPTING_ORDERS');
    const draft = seedShop(db, { name: 'Draft', status: 'draft' });
    expect(orderError(() => priceOrder(db, draft.shop, [{ itemId: draft.item['Sourdough loaf'].id, quantity: 1 }], 'pickup')).code)
      .toBe('SHOP_NOT_ACCEPTING_ORDERS');
  });

  it('reads the current price at pricing time', () => {
    const loaf = s.item['Sourdough loaf'];
    items.updateVariant(db, loaf.variants[0].id, { priceCents: 1000 });
    expect(priceOrder(db, s.shop, [{ itemId: loaf.id, quantity: 1 }], 'pickup').totalCents).toBe(1000);
  });
});
