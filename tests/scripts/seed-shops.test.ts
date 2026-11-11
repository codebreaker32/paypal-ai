// The other seeded shops (src/lib/demo/shops.ts): valid data, a real photo for every item, and the same publish path as
// Marigold with a fake PayPal, found again by their seed key, skipped without a seller email, listed on Browse.
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import { DEMO_PHOTOS, demoPhotoFor } from '@/lib/demo/photos';
import { SEED_SHOPS, isShopCategory } from '@/lib/demo/shops';
import { createFakePayPal } from '@/lib/paypal/fake';
import { DEMO_SHOP, seedAllShops, seedSellerShop } from '../../scripts/seed-demo';

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-seed-shops-'));
afterAll(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
const fileOf = (url: string) => path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
const PUBLIC_WORDS = /\b(demo|example|sample|test|fake)\b/i;

describe('SEED_SHOPS data', () => {
  it('has at least five shops besides Marigold, with unique keys and names, each on a Browse chip', () => {
    expect(SEED_SHOPS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SEED_SHOPS.map((s) => s.key)).size).toBe(SEED_SHOPS.length);
    expect(new Set(SEED_SHOPS.map((s) => s.name)).size).toBe(SEED_SHOPS.length);
    for (const s of SEED_SHOPS) expect(isShopCategory(s.category), s.name).toBe(true);
    expect(new Set([DEMO_SHOP.category, ...SEED_SHOPS.map((s) => s.category)])).toEqual(new Set(['food', 'drinks', 'gifts', 'repairs']));
  });

  it.each(SEED_SHOPS.filter((s) => 'items' in s.menu))('$name: 6 to 10 items, integer-cent prices, a real photo each, nothing that reads as made up', (def) => {
    const list = 'items' in def.menu ? def.menu.items : [];
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.length).toBeLessThanOrEqual(10);
    expect(new Set(list.map((i) => i.name)).size).toBe(list.length);
    for (const text of [def.name, def.about, def.pickupNotes]) expect(text).not.toMatch(PUBLIC_WORDS);
    for (const item of list) {
      expect(item.prices.length).toBeGreaterThan(0);
      for (const p of item.prices) {
        expect(Number.isInteger(p.cents), item.name).toBe(true);
        expect(p.cents).toBeGreaterThanOrEqual(100);
        expect(p.cents).toBeLessThanOrEqual(10000);
      }
      for (const text of [item.name, item.description ?? '']) expect(text).not.toMatch(PUBLIC_WORDS);
      const photo = demoPhotoFor(def.photos, item.name);
      expect(photo, item.name).toMatch(new RegExp(`^/demo/${def.photos}/[a-z0-9-]+\\.webp$`));
      expect(fs.existsSync(fileOf(photo!)), photo!).toBe(true);
    }
    const cover = DEMO_PHOTOS[def.photos].cover;
    expect(cover).toBe(`/demo/${def.photos}/cover.jpg`);
    expect(fs.existsSync(fileOf(cover!))).toBe(true);
  });
});

describe('seedSellerShop', () => {
  const payeeEmail = 'seller@example.com';

  it('without a seller email, skips every shop but Marigold (only Marigold may be paid to the platform)', async () => {
    const db = createTestDb();
    const pp = createFakePayPal();
    const { marigold, others } = await seedAllShops({ db, paypal: pp, uploadsDir });
    expect(marigold.shop.status).toBe('live');
    expect(others.every((o) => o.shop === null)).toBe(true);
    expect(shops.listBrowseShops(db).map((s) => s.slug)).toEqual([DEMO_SHOP.slug]);
  });

  it('publishes every shop live, paid to the seller, with a photo on every item and its category', async () => {
    const db = createTestDb();
    const pp = createFakePayPal();
    const { marigold, others } = await seedAllShops({ db, paypal: pp, uploadsDir, payeeEmail });
    expect(marigold.shop.category).toBe('food');
    for (const o of others) {
      expect(o.created).toBe(true);
      expect(o.ownerToken).toEqual(expect.any(String));
      expect(o.shop).toMatchObject({ name: o.def.name, status: 'live', payeeEmail, category: o.def.category, coverUrl: DEMO_PHOTOS[o.def.photos].cover });
      const all = items.listWithVariants(db, o.shop!.id);
      const live = all.filter((i) => i.status === 'live');
      expect(live.length).toBeGreaterThanOrEqual(6);
      expect(live.every((i) => i.paypalProductId)).toBe(true);
      for (const item of all) expect(item.photoUrl, `${o.def.name}: ${item.name}`).toMatch(/^\/demo\//);
    }
    // Sample shops keep their menu photo; the slugs come from the names.
    const tia = others.find((o) => o.def.key === 'tia-lupe')!.shop!;
    expect(tia.slug).toBe('tia-lupes-tacos');
    expect(tia.menuPhotoPaths).toEqual([`${tia.id}/seed-tia-lupe-chalkboard.jpg`]);
    expect(fs.existsSync(path.join(uploadsDir, tia.menuPhotoPaths[0]))).toBe(true);

    const browse = shops.listBrowseShops(db);
    expect(browse).toHaveLength(SEED_SHOPS.length + 1);
    const fern = browse.find((b) => b.name === 'Fern & Wick')!;
    expect(fern).toMatchObject({ category: 'gifts', coverUrl: '/demo/fern-and-wick/cover.jpg', avatar: { kind: 'cover', src: '/demo/fern-and-wick/cover.jpg' } });
    expect(fern.line).toMatch(/Elm St market/);
    expect(fern.itemNames).toContain('Soap sampler');
  });

  it('is idempotent, finds its shop by seed key even when a visitor took the name first, and --reset starts over', async () => {
    const db = createTestDb();
    const pp = createFakePayPal();
    const def = SEED_SHOPS.find((s) => s.key === 'little-ember')!;
    const visitor = shops.create(db, { name: def.name, payeeEmail: 'someone@example.com' }).shop;
    const first = await seedSellerShop(def, { db, paypal: pp, uploadsDir, payeeEmail });
    expect(first.shop!.id).not.toBe(visitor.id);
    expect(first.shop!.slug).toBe('little-ember-coffee-2');
    const calls = pp.calls.length;
    const again = await seedSellerShop(def, { db, paypal: pp, uploadsDir, payeeEmail });
    expect(again).toMatchObject({ created: false, ownerToken: null, published: 0 });
    expect(again.shop!.id).toBe(first.shop!.id);
    expect(pp.calls.length).toBe(calls);
    const reset = await seedSellerShop(def, { db, paypal: pp, uploadsDir, payeeEmail, reset: true });
    expect(reset.created).toBe(true);
    expect(reset.shop!.id).not.toBe(first.shop!.id);
    expect(shops.byId(db, visitor.id)).toMatchObject({ name: def.name });
  });
});
