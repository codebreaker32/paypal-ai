// The demo seed with a fake PayPal: creates, resolves, publishes and goes live; idempotent; --reset starts over.
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import { createFakePayPal } from '@/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../../scripts/seed-demo';

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-seed-'));
afterAll(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

describe('seedDemoShop', () => {
  const db = createTestDb();
  const paypal = createFakePayPal();

  it('creates Marigold Bakehouse live, with its priced items in the PayPal catalog', async () => {
    const r = await seedDemoShop({ db, paypal, uploadsDir });
    expect(r.created).toBe(true);
    expect(r.ownerToken).toEqual(expect.any(String));
    expect(r.shop).toMatchObject({
      name: 'Marigold Bakehouse', slug: DEMO_SHOP.slug, status: 'live', kind: 'food', fulfillment: 'both', shippingFeeCents: 800,
      pickupNotes: 'Sat & Sun pickup · 14 Alder St · order by Fri 6pm',
    });
    expect(r.shop.menuPhotoPaths).toEqual([`${r.shop.id}/page-1.jpg`]);
    expect(fs.existsSync(path.join(uploadsDir, r.shop.id, 'page-1.jpg'))).toBe(true);

    const all = items.listWithVariants(db, r.shop.id);
    const live = all.filter((i) => i.status === 'live');
    expect(live.map((i) => i.name)).toContain('Almond croissant');
    expect(live.map((i) => i.name)).toContain('Country sourdough loaf');
    expect(live.every((i) => i.paypalProductId && i.issues.length === 0)).toBe(true);
    expect(r.published).toBe(live.length);
    expect(all.find((i) => i.name === 'Seasonal fruit galette')).toMatchObject({ status: 'in_person', issues: [] });
    // Accepted "Looks right" fixes keep the price read from the photo.
    expect(all.find((i) => i.name === 'Cardamom bun')!.variants[0].priceCents).toBe(350);
    // Catalog calls: food category, one request id per item.
    const productCalls = paypal.calls.filter((c) => c.method === 'createProduct');
    expect(productCalls).toHaveLength(live.length);
    expect(productCalls[0].args[0]).toMatchObject({ type: 'PHYSICAL', category: 'FOOD_RETAIL_AND_SERVICE' });
    expect(new Set(productCalls.map((c) => c.args[1])).size).toBe(live.length);
  });

  it('is idempotent: a second run reuses the shop and publishes nothing', async () => {
    const before = paypal.calls.length;
    const r = await seedDemoShop({ db, paypal, uploadsDir });
    expect(r.created).toBe(false);
    expect(r.ownerToken).toBeNull();
    expect(r.published).toBe(0);
    expect(paypal.calls.length).toBe(before);
  });

  it('--reset deletes the shop and creates it again', async () => {
    const first = (await seedDemoShop({ db, paypal, uploadsDir })).shop;
    const r = await seedDemoShop({ db, paypal, uploadsDir, reset: true });
    expect(r.created).toBe(true);
    expect(r.shop.id).not.toBe(first.id);
    expect(r.shop.slug).toBe(DEMO_SHOP.slug);
    expect(fs.existsSync(path.join(uploadsDir, first.id))).toBe(false);
  });
});
