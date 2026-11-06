import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import { RESERVED_SLUG, canGoLive, publishShop, type PublishProgress } from '@/lib/catalog/publish';
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
    expect(first.failed).toEqual([{ itemId: failedId, message: 'PayPal had a problem on its side. Retry in a moment.' }]);
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
    expect(bad).toMatchObject({ type: 'item', ok: false, message: "PayPal didn’t add this item. Retry in a moment." });
  });

  describe('what the seller reads when PayPal turns an item down', () => {
    const cases: [string, Error, RegExp][] = [
      ['a malformed request', new PayPalApiError(400, 'INVALID_REQUEST', 'INVALID_PARAMETER_SYNTAX', 'dbg-1', 'Request is not well-formed, syntactically incorrect, or violates schema.'), /^PayPal didn’t accept this item’s name or description\.$/],
      ['a rejected value', new PayPalApiError(422, 'UNPROCESSABLE_ENTITY', 'INVALID_STRING_LENGTH', 'dbg-2', 'The requested action could not be performed.'), /^PayPal didn’t accept this item’s name or description\.$/],
      ['wrong sandbox keys', new PayPalApiError(401, 'invalid_client', null, null, 'Client Authentication failed'), /sandbox keys.*PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY/],
      ['too many requests', new PayPalApiError(429, 'RATE_LIMIT_REACHED', null, 'dbg-3', 'Too many requests. Blocked due to rate limiting.'), /^PayPal is busy right now/],
      ['a PayPal outage', new PayPalApiError(503, 'SERVICE_UNAVAILABLE', null, 'dbg-4', 'Service Unavailable.'), /^PayPal had a problem on its side/],
      ['no network', Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND api-m.sandbox.paypal.com'), { code: 'ENOTFOUND' }) }), /^We couldn’t reach PayPal/],
    ];

    for (const [what, err, expected] of cases) {
      it(`${what}: a plain message, and the raw error only in the server log`, async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());
        paypal.failNext('createProduct', err);
        const r = await publishShop({ db, paypal }, shopId);
        expect(r.failed).toHaveLength(1);
        expect(r.failed[0].message).toMatch(expected);
        expect(r.failed[0].message).not.toContain(err.message);
        const logged = warn.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(logged).toContain(err.message);
        expect(logged).toContain(r.failed[0].itemId);
      });
    }

    it('the server log keeps PayPal\'s debug id', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());
      paypal.failNext('createProduct', cases[0][1]);
      await publishShop({ db, paypal }, shopId);
      expect(warn.mock.calls.map((c) => c.join(' ')).join('\n')).toMatch(/400 INVALID_REQUEST.*dbg-1/);
    });
  });

  it('a progress listener that throws (a browser that left) changes nothing: the shop still goes live', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    let heard = 0;
    const result = await publishShop({ db, paypal }, shopId, () => {
      heard++;
      throw new TypeError('Invalid state: Controller is already closed');
    });
    expect(heard).toBe(2);
    expect(result).toEqual({ published: 2, failed: [] });
    expect(paypal.calls.filter((c) => c.method === 'createProduct')).toHaveLength(2);
    for (const name of ['Butter croissant', 'Drip coffee']) expect(byName(db, shopId, name).status).toBe('live');
    const shop = shops.byId(db, shopId)!;
    expect(shop.status).toBe('live');
    expect(shop.slug).toBe('marigold-bakehouse');
  });

  it('a throwing listener never turns a failed item into a crash or a double count', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    paypal.failNext('createProduct', new PayPalApiError(500, 'INTERNAL_SERVICE_ERROR', null, 'dbg', 'PayPal had a hiccup'));
    const result = await publishShop({ db, paypal }, shopId, () => {
      throw new Error('listener gone');
    });
    expect(result.published).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(shops.byId(db, shopId)!.status).toBe('live');
  });

  describe('a run that broke before the shop went live', () => {
    // Every publishable item reached PayPal, but the shop is still a draft with its draft slug.
    function brokenRun(): string {
      const id = shops.create(db, { name: 'draft q1w2e3r4' }).shop.id;
      shops.update(db, id, { name: "Tía Lupe's" });
      items.replaceDrafts(db, id, [draft('Taco', [350]), draft('Agua fresca', [300])]);
      for (const it of items.listWithVariants(db, id)) items.setPayPalProductId(db, it.id, `PROD-${it.id}`);
      return id;
    }

    it('canGoLive is true only for a draft shop with items in PayPal', () => {
      const id = brokenRun();
      expect(canGoLive(db, id)).toBe(true);
      expect(canGoLive(db, shopId)).toBe(false); // a draft with nothing in PayPal yet
      shops.publish(db, id);
      expect(canGoLive(db, id)).toBe(false); // already live
    });

    it('a re-run makes no PayPal calls and finishes going live, with the real slug', async () => {
      const id = brokenRun();
      const before = paypal.calls.length;
      const r = await publishShop({ db, paypal }, id);
      expect(r).toEqual({ published: 0, failed: [] });
      expect(paypal.calls.length).toBe(before);
      const shop = shops.byId(db, id)!;
      expect(shop.status).toBe('live');
      expect(shop.slug).toBe('tia-lupes');
    });
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

  it('keeps an item removed while PayPal was creating it (it does not go live)', async () => {
    const croissant = byName(db, shopId, 'Butter croissant');
    const gated = {
      ...paypal,
      async createProduct(p: Parameters<FakePayPal['createProduct']>[0], requestId: string) {
        if (requestId === `pub-${croissant.id}`) items.update(db, croissant.id, { status: 'removed' });
        return paypal.createProduct(p, requestId);
      },
    };
    await publishShop({ db, paypal: gated }, shopId);
    const after = byName(db, shopId, 'Butter croissant');
    expect(after.status).toBe('removed');
    // The product id is still recorded, so a retry never creates it twice.
    expect(after.paypalProductId).toMatch(/^PROD-/);
    expect(byName(db, shopId, 'Drip coffee').status).toBe('live');
  });

  it('sends the latest version of an item edited while it waited its turn, and keeps one removed off the shop', async () => {
    const many = shops.create(db, { name: 'Many' }).shop.id;
    items.replaceDrafts(db, many, Array.from({ length: 5 }, (_, i) => draft(`Thing ${i}`, [100 + i])));
    const [, , , fourth, fifth] = items.listWithVariants(db, many);
    let first = true;
    const editing = {
      ...paypal,
      async createProduct(p: Parameters<FakePayPal['createProduct']>[0], requestId: string) {
        if (first) {
          first = false;
          items.update(db, fourth.id, { name: 'Thing four, renamed' });
          items.update(db, fifth.id, { status: 'removed' });
        }
        return paypal.createProduct(p, requestId);
      },
    };
    const r = await publishShop({ db, paypal: editing }, many);
    const sent = paypal.calls.filter((c) => c.method === 'createProduct').map((c) => (c.args[0] as { name: string }).name);
    expect(sent).toContain('Thing four, renamed');
    expect(sent).not.toContain('Thing 3');
    // The removed one is never sent: it comes back as not added.
    expect(r.failed.map((f) => f.itemId)).toEqual([fifth.id]);
    expect(items.listWithVariants(db, many).find((i) => i.id === fifth.id)).toMatchObject({ status: 'removed', paypalProductId: null });
  });

  it('skips an item moved to "ask in person" or removed while it waited its turn, and still reports it', async () => {
    const many = shops.create(db, { name: 'Many' }).shop.id;
    items.replaceDrafts(db, many, Array.from({ length: 5 }, (_, i) => draft(`Thing ${i}`, [100 + i])));
    const [, , , fourth, fifth] = items.listWithVariants(db, many);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const deferred = {
      ...paypal,
      async createProduct(p: Parameters<FakePayPal['createProduct']>[0], requestId: string) {
        await gate;
        return paypal.createProduct(p, requestId);
      },
    };
    const events: PublishProgress[] = [];
    const running = publishShop({ db, paypal: deferred }, many, (e) => events.push(e));
    // The first 3 are with PayPal; the 4th and 5th wait their turn while the seller changes them.
    items.update(db, fourth.id, { status: 'in_person' });
    items.update(db, fifth.id, { status: 'removed' });
    release();
    const r = await running;

    const sent = paypal.calls.filter((c) => c.method === 'createProduct').map((c) => c.args[1]);
    expect(sent).toHaveLength(3);
    expect(sent).not.toContain(`pub-${fourth.id}`);
    expect(sent).not.toContain(`pub-${fifth.id}`);
    expect(items.byIdForShop(db, many, fourth.id)).toMatchObject({ status: 'in_person', paypalProductId: null });
    expect(items.byIdForShop(db, many, fifth.id)).toMatchObject({ status: 'removed', paypalProductId: null });

    // Every queued item still gets one line of progress, and the result agrees with the stream.
    expect(r.published).toBe(3);
    expect(events).toHaveLength(5);
    const notAdded = events.filter((e) => !e.ok);
    expect(notAdded.map((e) => e.itemId).sort()).toEqual([fourth.id, fifth.id].sort());
    expect(r.failed.map((f) => f.itemId).sort()).toEqual([fourth.id, fifth.id].sort());
    for (const f of r.failed) expect(f.message).toBe('This item changed while publishing, so it wasn’t sent to PayPal.');
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

  it("never gives a visitor's shop the demo shop's slug, even before the demo shop exists", async () => {
    const fresh = createTestDb();
    const visitor = () => {
      const id = shops.create(fresh, { name: `draft ${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}` }).shop.id;
      shops.update(fresh, id, { name: 'Marigold Bakehouse' });
      items.replaceDrafts(fresh, id, [draft('Bun', [300])]);
      return id;
    };
    const first = visitor();
    await publishShop({ db: fresh, paypal }, first);
    expect(shops.byId(fresh, first)!.slug).toBe('marigold-bakehouse-2');
    expect(shops.bySlug(fresh, RESERVED_SLUG)).toBeNull();

    const second = visitor();
    await publishShop({ db: fresh, paypal }, second);
    expect(shops.byId(fresh, second)!.slug).toBe('marigold-bakehouse-3');
  });
});
