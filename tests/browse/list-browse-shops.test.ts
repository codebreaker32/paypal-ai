// /browse lists every shop a buyer can order from: the same rule as /agents.txt and the agent door (takesOrders).
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db';
import { listBrowseShops } from '@/lib/db/repos/browse';
import * as shops from '@/lib/db/repos/shops';
import { INDEX_LIMIT } from '@/lib/discovery/index-file';
import { parseShopCategory } from '@/lib/domain/shop-category';
import { takesOrders } from '@/lib/orders/pricing';
import { seedShop } from '../helpers/shop';

describe('listBrowseShops', () => {
  it('lists every live shop that takes orders, newest first, and nothing else', () => {
    const db = createTestDb();
    seedShop(db); // Marigold: the reserved slug, paid to the platform
    seedShop(db, { name: 'Rosa Bakes' });
    seedShop(db, { name: 'Paused Pies', status: 'paused' });
    seedShop(db, { name: 'No Email Co', payeeEmail: null });
    shops.create(db, { name: 'Draft Donuts' });
    seedShop(db, { name: 'Ravi Bike Repair' });

    const listed = listBrowseShops(db);
    expect(listed.map((s) => s.name)).toEqual(['Ravi Bike Repair', 'Rosa Bakes', 'Marigold Bakehouse']);
    // The same shops as the discovery files, and exactly the ones whose door takes orders.
    expect(listed.map((s) => s.slug)).toEqual(shops.listOrderableForIndex(db, INDEX_LIMIT).map((s) => s.slug));
    for (const s of listed) expect(takesOrders(shops.bySlug(db, s.slug)!)).toBe(true);
  });

  it('gives each card its words, pictures and listed item names', () => {
    const db = createTestDb();
    const { shop } = seedShop(db, { name: 'Rosa Bakes' });
    shops.update(db, shop.id, { coverUrl: '/i/cover.webp' });
    const [card] = listBrowseShops(db);
    expect(card).toMatchObject({
      slug: 'rosa-bakes',
      name: 'Rosa Bakes',
      category: null,
      kind: shop.kind,
      coverUrl: '/i/cover.webp',
      line: 'Weekend bakes from a home kitchen in Austin.',
    });
    // Listed items only (live and in person), in menu order: no removed or draft ones.
    expect(card.itemNames).toContain('Almond croissant');
    expect(card.itemNames).toContain('Market fish');
    expect(card.itemNames).not.toContain('Old scone');
    expect(card.itemNames).not.toContain('Secret menu');
    expect(card.avatar.shop).toEqual({ logoUrl: null, coverUrl: '/i/cover.webp', kind: shop.kind, menuPhotoSrc: null });
    expect(card.avatar.items.map((i) => i.name)).toEqual(card.itemNames);
  });

  it('falls back to the pickup place, then to what the shop sells, when there is no about line', () => {
    const db = createTestDb();
    const { shop } = seedShop(db, { name: 'Rosa Bakes', fulfillment: 'pickup' });
    shops.update(db, shop.id, { about: '  ' });
    expect(listBrowseShops(db)[0].line).toBe('Pickup: Saturday 8–12 at the Mueller farmers market');
    shops.update(db, shop.id, { pickupNotes: '' });
    expect(listBrowseShops(db)[0].line).toMatch(/^Almond croissant, Butter croissant and .+, and more$/);
  });

  it('reads the category column, any case, and leaves unknown values under All only', () => {
    const db = createTestDb();
    const a = seedShop(db, { name: 'Petal Stand' }).shop;
    const b = seedShop(db, { name: 'Odd Shop' }).shop;
    db.prepare('UPDATE shops SET category = ? WHERE id = ?').run('Flowers', a.id);
    db.prepare('UPDATE shops SET category = ? WHERE id = ?').run('spaceships', b.id);
    const byName = Object.fromEntries(listBrowseShops(db).map((s) => [s.name, s.category]));
    expect(byName).toEqual({ 'Petal Stand': 'flowers', 'Odd Shop': null });
  });
});

describe('parseShopCategory', () => {
  it.each([
    ['food', 'food'], [' Drinks ', 'drinks'], ['REPAIRS', 'repairs'], ['bakery', null], [null, null], [3, null],
  ] as const)('%j is %j', (raw, want) => expect(parseShopCategory(raw)).toBe(want));
});
