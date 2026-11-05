import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import { publishShop, type PublishProgress } from '@/lib/catalog/publish';
import { createFakePayPal, type FakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError } from '@/lib/paypal/types';
import type { DraftItem } from '@/lib/domain/types';

const draft = (name: string, prices: (number | null)[], extra: Partial<DraftItem> = {}): DraftItem => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p })),
  ...extra,
});

const byName = (db: Database.Database, shopId: string, name: string) =>
  items.listWithVariants(db, shopId).find((i) => i.name === name)!;

describe('publishShop', () => {
  let db: Database.Database;
  let paypal: FakePayPal;
  let shopId: string;

  beforeEach(() => {
    db = createTestDb();
    paypal = createFakePayPal();
    shopId = shops.create(db, { name: 'Marigold Bakehouse', kind: 'food' }).shop.id;
    items.replaceDrafts(db, shopId, [
      draft('Butter croissant', [425], { description: 'Laminated by hand' }),
      draft('Focaccia', [800], { issues: ['CHECK'], issueDetail: 'Crossed out' }),
      draft('Pain au chocolat', [null], { issues: ['MISSING_PRICE'] }),
      draft('Galette', [null], { issues: ['MARKET_PRICE'], status: 'in_person' }),
      draft('Old scone', [300], { status: 'removed' }),
      draft('Drip coffee', [300, 400], { section: 'Coffee' }),
      draft('Mystery loaf', [null]), // resolved, but still has no price
    ]);
  });

  it('publishes only resolved, fully priced draft items and marks them live', async () => {
    const result = await publishShop({ db, paypal }, shopId);
    expect(result).toEqual({ published: 2, failed: [] });
    expect(paypal.calls.filter((c) => c.method === 'createProduct')).toHaveLength(2);

    for (const name of ['Butter croissant', 'Drip coffee']) {
      const it = byName(db, shopId, name);
      expect(it.status).toBe('live');
      expect(it.paypalProductId).toMatch(/^PROD-/);
    }
    for (const name of ['Focaccia', 'Pain au chocolat', 'Galette', 'Old scone', 'Mystery loaf']) {
      expect(byName(db, shopId, name).paypalProductId).toBeNull();
    }
    // "Ask in person" items stay listed but never reach PayPal.
    expect(byName(db, shopId, 'Galette').status).toBe('in_person');
  });

  it('sends the request id, type, category and a short description', async () => {
    await publishShop({ db, paypal }, shopId);
    const croissant = byName(db, shopId, 'Butter croissant');
    const coffee = byName(db, shopId, 'Drip coffee');
    const sent = new Map(paypal.calls.map((c) => [c.args[1] as string, c.args[0]]));
    expect(sent.get(`pub-${croissant.id}`)).toEqual({
      name: 'Butter croissant', type: 'PHYSICAL', category: 'FOOD_RETAIL_AND_SERVICE', description: 'Laminated by hand',
    });
    // No description: the section name stands in.
    expect(sent.get(`pub-${coffee.id}`)).toMatchObject({ description: 'Coffee' });
  });

  it('uses SERVICE products and no category for a services shop', async () => {
    const ravi = shops.create(db, { name: "Ravi's Bike Repair", kind: 'services' }).shop.id;
    items.replaceDrafts(db, ravi, [draft('Flat fix', [1500], { kind: 'SERVICE', section: null })]);
    await publishShop({ db, paypal }, ravi);
    const sent = paypal.calls.at(-1)!.args[0] as Record<string, unknown>;
    expect(sent).toEqual({ name: 'Flat fix', type: 'SERVICE' });
  });

  it('trims descriptions to 256 characters', async () => {
    const it = byName(db, shopId, 'Butter croissant');
    items.update(db, it.id, { description: 'x'.repeat(400) });
    await publishShop({ db, paypal }, shopId);
    const call = paypal.calls.find((c) => c.args[1] === `pub-${it.id}`)!;
    expect((call.args[0] as { description: string }).description).toHaveLength(256);
  });

  it('makes no PayPal calls on a second run', async () => {
    await publishShop({ db, paypal }, shopId);
    const before = paypal.calls.length;
    const again = await publishShop({ db, paypal }, shopId);
    expect(again).toEqual({ published: 0, failed: [] });
    expect(paypal.calls.length).toBe(before);
  });

  it('reports a failed item, publishes the rest, and a retry publishes only the failed one', async () => {
    paypal.failNext('createProduct', new PayPalApiError(500, 'INTERNAL_SERVICE_ERROR', null, 'dbg', 'PayPal had a hiccup'));
    const first = await publishShop({ db, paypal }, shopId);
    const failedId = (paypal.calls[0].args[1] as string).replace(/^pub-/, '');
    expect(first.published).toBe(1);
    expect(first.failed).toEqual([{ itemId: failedId, message: 'PayPal had a hiccup' }]);
    expect(items.byIdForShop(db, shopId, failedId)!.paypalProductId).toBeNull();

    const callsBefore = paypal.calls.length;
    const retry = await publishShop({ db, paypal }, shopId);
    expect(retry).toEqual({ published: 1, failed: [] });
    expect(paypal.calls.slice(callsBefore).map((c) => c.args[1])).toEqual([`pub-${failedId}`]);
  });

  it('reports progress once per item', async () => {
    paypal.failNext('createProduct', new Error('boom'));
    const events: PublishProgress[] = [];
    await publishShop({ db, paypal }, shopId, (e) => events.push(e));
    expect(events).toHaveLength(2);
    const ok = events.find((e) => e.ok)!;
    const bad = events.find((e) => !e.ok)!;
    expect(ok).toMatchObject({ type: 'item', ok: true, paypalProductId: expect.stringMatching(/^PROD-/) });
    expect(bad).toMatchObject({ type: 'item', ok: false, message: 'boom' });
  });

  it('runs at most 3 PayPal calls at once', async () => {
    const many = shops.create(db, { name: 'Many' }).shop.id;
    items.replaceDrafts(db, many, Array.from({ length: 8 }, (_, i) => draft(`Thing ${i}`, [100 + i])));
    let inFlight = 0;
    let peak = 0;
    const slow = {
      ...paypal,
      async createProduct(p: Parameters<FakePayPal['createProduct']>[0], requestId: string) {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return paypal.createProduct(p, requestId);
      },
    };
    const r = await publishShop({ db, paypal: slow }, many);
    expect(r.published).toBe(8);
    expect(peak).toBe(3);
  });

  it('makes the shop live and keeps it live on later runs', async () => {
    await publishShop({ db, paypal }, shopId);
    const shop = shops.byId(db, shopId)!;
    expect(shop.status).toBe('live');
    expect(shop.publishedAt).not.toBeNull();
  });

  it('leaves the shop a draft when nothing could be published', async () => {
    paypal.failNext('createProduct', new Error('down'));
    const solo = shops.create(db, { name: 'Solo' }).shop.id;
    items.replaceDrafts(db, solo, [draft('Only thing', [500])]);
    const r = await publishShop({ db, paypal }, solo);
    expect(r.published).toBe(0);
    expect(r.failed).toHaveLength(1);
    expect(shops.byId(db, solo)!.status).toBe('draft');
  });

  it('does not un-pause a paused shop', async () => {
    await publishShop({ db, paypal }, shopId);
    shops.update(db, shopId, { status: 'paused' });
    items.update(db, byName(db, shopId, 'Focaccia').id, { issues: [] });
    const r = await publishShop({ db, paypal }, shopId);
    expect(r.published).toBe(1);
    expect(shops.byId(db, shopId)!.status).toBe('paused');
  });

  it('gives a draft shop its real slug from its name on first publish', async () => {
    const id = shops.create(db, { name: 'draft k7f2qxm4' }).shop.id;
    shops.update(db, id, { name: "Rosa's Bakes" });
    items.replaceDrafts(db, id, [draft('Bun', [300])]);
    await publishShop({ db, paypal }, id);
    expect(shops.byId(db, id)!.slug).toBe('rosas-bakes');

    // Once live, the slug never changes again.
    shops.update(db, id, { name: 'Something else' });
    items.replaceDrafts(db, id, [draft('Roll', [200])]);
    await publishShop({ db, paypal }, id);
    expect(shops.byId(db, id)!.slug).toBe('rosas-bakes');
  });

  it('picks a free slug when the name is taken', async () => {
    shops.create(db, { name: 'Rosa' });
    const id = shops.create(db, { name: 'draft aaaa1111' }).shop.id;
    shops.update(db, id, { name: 'Rosa' });
    items.replaceDrafts(db, id, [draft('Bun', [300])]);
    await publishShop({ db, paypal }, id);
    expect(shops.byId(db, id)!.slug).toBe('rosa-2');
  });
});
