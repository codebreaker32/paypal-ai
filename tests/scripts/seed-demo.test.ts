// The demo seed with a fake PayPal: creates, resolves, publishes and goes live; idempotent; --reset starts over.
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishShop, productFor } from '@/lib/catalog/publish';
import { createTestDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import { createFakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError } from '@/lib/paypal/types';
import * as orders from '@/lib/db/repos/orders';
import { createOrderForShop } from '@/lib/orders/service';
import { DEMO_PHOTO, DEMO_SHOP, seedDemoShop } from '../../scripts/seed-demo';

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
    // The seed's own photo name is its marker: no upload or sample is ever stored under it.
    expect(r.shop.menuPhotoPaths).toEqual([`${r.shop.id}/${DEMO_PHOTO}`]);
    expect(fs.existsSync(path.join(uploadsDir, r.shop.id, DEMO_PHOTO))).toBe(true);

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

  it('publishes through the same path as the setup flow (publishShop): the same product for each item', async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    const r = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    const sent = pp.calls.filter((c) => c.method === 'createProduct');
    for (const item of items.listWithVariants(fresh, r.shop.id, { status: ['live'] })) {
      const call = sent.find((c) => c.args[1] === `pub-${item.id}`);
      expect(call?.args[0]).toEqual(productFor(item, r.shop));
    }
  });

  it('reports an item PayPal turned down, and a re-run publishes only that item', async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    pp.failNext('createProduct', new PayPalApiError(503, 'SERVICE_UNAVAILABLE', null, 'dbg', 'busy'));
    const warn = console.warn;
    console.warn = () => {};
    const first = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir }).finally(() => (console.warn = warn));
    expect(first.failed).toHaveLength(1);
    expect(first.shop.status).toBe('live');

    const again = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    expect(again).toMatchObject({ created: false, published: 1, failed: [] });
  });

  it("keeps its slug when a visitor's Marigold sample was published first", async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    const visitor = shops.create(fresh, { name: 'draft abcd2345' }).shop.id;
    shops.update(fresh, visitor, { name: 'Marigold Bakehouse' });
    items.replaceDrafts(fresh, visitor, [
      { section: 'Pastries', name: 'Bun', description: null, sourceText: 'Bun $3', confidence: 'high', kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 300 }] },
    ]);
    await publishShop({ db: fresh, paypal: pp }, visitor);
    expect(shops.byId(fresh, visitor)!.slug).not.toBe(DEMO_SHOP.slug);

    const r = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    expect(r.shop.slug).toBe(DEMO_SHOP.slug);
  });

  it("never adopts or deletes a shop it didn't create, even one holding the demo slug", async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    // A shop from before the slug was reserved: someone's published Marigold sample.
    const theirs = shops.create(fresh, { name: 'Marigold Bakehouse' }).shop;
    expect(theirs.slug).toBe(DEMO_SHOP.slug);
    await expect(seedDemoShop({ db: fresh, paypal: pp, uploadsDir })).rejects.toThrow(/not the demo shop/);
    await expect(seedDemoShop({ db: fresh, paypal: pp, uploadsDir, reset: true })).rejects.toThrow(/not the demo shop/);
    expect(shops.byId(fresh, theirs.id)).toMatchObject({ slug: DEMO_SHOP.slug, menuPhotoPaths: [] });
    expect(pp.calls).toHaveLength(0);
  });

  it('reports unpaid rehearsal orders and cancels them with cancelUnpaid, leaving paid ones alone', async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    const { shop } = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    const croissant = items.listWithVariants(fresh, shop.id).find((i) => i.name === 'Almond croissant')!;
    const deps = { db: fresh, paypal: pp, appUrl: 'http://localhost:3000' };
    const place = (key: string) => createOrderForShop(deps, shop, { lines: [{ itemId: croissant.id, quantity: 1 }], fulfillment: 'pickup', clientKey: 'local', clientRequestId: key });
    const a = await place('rehearsal-a');
    await place('rehearsal-b');
    const paid = await place('rehearsal-c');
    orders.casStatus(fresh, paid.id, 'awaiting_approval', 'approved');

    const report = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    expect(report.unpaid).toBe(2);
    expect(report.cancelled).toBe(0);
    expect(orders.byId(fresh, a.id)!.status).toBe('awaiting_approval');

    const cleared = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir, cancelUnpaid: true });
    expect(cleared).toMatchObject({ unpaid: 0, cancelled: 2 });
    expect(orders.byId(fresh, a.id)!.status).toBe('cancelled');
    expect(orders.byId(fresh, paid.id)!.status).toBe('approved');
  });

  it('cancelUnpaid syncs with PayPal first: an order the buyer already approved is captured, not cancelled', async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    const { shop } = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    const croissant = items.listWithVariants(fresh, shop.id).find((i) => i.name === 'Almond croissant')!;
    const deps = { db: fresh, paypal: pp, appUrl: 'http://localhost:3000' };
    const place = (key: string) => createOrderForShop(deps, shop, { lines: [{ itemId: croissant.id, quantity: 1 }], fulfillment: 'pickup', clientKey: 'local', clientRequestId: key });
    const approved = await place('approved-at-paypal');
    const abandoned = await place('never-opened');
    pp.approve(approved.paypalOrderId!);

    const r = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir, cancelUnpaid: true });
    expect(orders.byId(fresh, approved.id)!.status).toBe('paid');
    expect(orders.byId(fresh, abandoned.id)!.status).toBe('cancelled');
    expect(r).toMatchObject({ unpaid: 0, cancelled: 1 });
  });

  it('does not count orders past their expiry as waiting (they no longer hold the cap)', async () => {
    const fresh = createTestDb();
    const pp = createFakePayPal();
    const { shop } = await seedDemoShop({ db: fresh, paypal: pp, uploadsDir });
    const croissant = items.listWithVariants(fresh, shop.id).find((i) => i.name === 'Almond croissant')!;
    const old = Date.now() - 2 * 60 * 60_000;
    const deps = { db: fresh, paypal: pp, appUrl: 'http://localhost:3000', now: () => old };
    await createOrderForShop(deps, shop, { lines: [{ itemId: croissant.id, quantity: 1 }], fulfillment: 'pickup', clientKey: 'local', clientRequestId: 'stale' });
    expect((await seedDemoShop({ db: fresh, paypal: pp, uploadsDir })).unpaid).toBe(0);
  });
});
