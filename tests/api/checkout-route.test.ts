// POST /api/checkout/[slug]: the cart's one money path.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import { STOREFRONT_AGENT_NAME } from '@/lib/domain/storefront';
import { createFakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError } from '@/lib/paypal/types';
import { CREATE_ORDER_RATE } from '@/lib/mcp/tools';
import { MAX_OPEN_ORDERS_PER_CLIENT, MAX_OPEN_ORDERS_PER_SHOP, syncOrder } from '@/lib/orders/service';
import * as eventsRepo from '@/lib/db/repos/events';
import { resetRateLimits } from '@/lib/rate-limit';
import { getOrderDeps, setPayPalForServices } from '@/lib/services';
import { POST, runtime } from '@/app/api/checkout/[slug]/route';
import { seedShop, type SeededShop } from '../helpers/shop';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-checkout-'));
const fake = createFakePayPal();
let s: SeededShop;
let n = 0;

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(tmp, 'test.db');
  process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
  process.env.APP_URL = 'http://localhost:3102';
  setPayPalForServices(fake);
});
afterAll(() => {
  setPayPalForServices(undefined);
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => {
  resetRateLimits();
  fake.calls.length = 0;
  s = seedShop(getDb(), { name: `Checkout Bakery ${++n} ${Date.now()}` });
});

const IP = '203.0.113.10';
const createCalls = () => fake.calls.filter((c) => c.method === 'createOrder');
const body = (over: Record<string, unknown> = {}) => ({
  lines: [{ itemId: s.item['Almond croissant'].id, quantity: 2 }],
  fulfillment: 'pickup',
  expectedTotalCents: 950,
  requestId: `request-${n}-0001`,
  ...over,
});
function post(raw: unknown, opts: { ip?: string; headers?: Record<string, string>; slug?: string } = {}): Request {
  return new Request(`http://localhost:3102/api/checkout/${opts.slug ?? s.shop.slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost:3102', 'x-forwarded-for': opts.ip ?? IP, ...opts.headers },
    body: typeof raw === 'string' ? raw : JSON.stringify(raw),
  });
}
const send = (req: Request, slug = s.shop.slug) => POST(req, { params: Promise.resolve({ slug }) });
const checkout = (over: Record<string, unknown> = {}, opts: { ip?: string } = {}) => send(post(body(over), opts));

type Failure = { error: { code: string; message: string; itemId?: string; scope?: string } };
const failure = async (res: Response) => ((await res.json()) as Failure).error;
type Success = { orderRef: string; number: string; approvalUrl: string; totalCents: number };

describe('POST /api/checkout/[slug]', () => {
  it('runs in the Node runtime', () => expect(runtime).toBe('nodejs'));

  describe('a good request', () => {
    it('answers 201 with what the client needs and nothing else', async () => {
      const res = await checkout();
      expect(res.status).toBe(201);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const created = (await res.json()) as Success;
      expect(Object.keys(created).sort()).toEqual(['approvalUrl', 'number', 'orderRef', 'totalCents']);
      expect(created.totalCents).toBe(950);
      const order = orders.byId(getDb(), created.orderRef)!;
      expect(order.number).toBe(created.number);
      expect(order.approvalUrl).toBe(created.approvalUrl);
      expect(order.status).toBe('awaiting_approval');
    });

    it('stores the storefront as the source, the note, the request id and the IP as its client', async () => {
      const created = (await (await checkout({ note: 'No nuts please' })).json()) as Success;
      const order = orders.byId(getDb(), created.orderRef)!;
      expect(order.agentName).toBe(STOREFRONT_AGENT_NAME);
      expect(order.buyerNote).toBe('No nuts please');
      expect(order.clientRequestId).toBe(body().requestId);
      expect(Date.parse(order.expiresAt) - Date.parse(order.createdAt)).toBeLessThanOrEqual(20 * 60_000 + 2_000);
      const [created_] = eventsRepo.list(getDb(), order.id);
      expect(created_.source).toBe('mcp');
      expect(created_.detail).toMatchObject({ agentName: STOREFRONT_AGENT_NAME });
    });

    it('adds shipping from the shop, not the client', async () => {
      const res = await checkout({ fulfillment: 'shipping', expectedTotalCents: 950 + 800 });
      expect(res.status).toBe(201);
      expect(((await res.json()) as Success).totalCents).toBe(1750);
    });

    it('takes an option id', async () => {
      const coffee = s.item['Drip coffee'];
      const res = await checkout({ lines: [{ itemId: coffee.id, optionId: coffee.variants[1].id, quantity: 1 }], expectedTotalCents: 400 });
      expect(res.status).toBe(201);
    });
  });

  describe('same origin and rate limit come first', () => {
    it('refuses another site before anything else', async () => {
      const req = post(body(), { headers: { origin: 'https://evil.example' } });
      const res = await send(req);
      expect(res.status).toBe(403);
      expect((await failure(res)).code).toBe('BAD_ORIGIN');
      expect(req.bodyUsed).toBe(false);
      expect(createCalls()).toHaveLength(0);
    });

    it('accepts its own origin', async () => {
      expect((await send(post(body(), { headers: { origin: 'http://localhost:3102' } }))).status).toBe(201);
    });

    it('does no reading or pricing work once over the limit', async () => {
      // Each of these fails validation, so no PayPal calls and no open-order cap: only the limiter counts them.
      for (let i = 0; i < CREATE_ORDER_RATE.limit; i++) {
        expect((await send(post({ nope: true }))).status).toBe(400);
      }
      const req = post(body());
      const res = await send(req);
      expect(res.status).toBe(429);
      const e = await failure(res);
      expect(e.code).toBe('RATE_LIMITED');
      expect(e.message).toBe('You’ve tried a lot in the last hour. Try again later.');
      expect(req.bodyUsed).toBe(false);
      expect(createCalls()).toHaveLength(0);
    });

    it('limits per address, and separately from the agent door', async () => {
      for (let i = 0; i < CREATE_ORDER_RATE.limit; i++) await send(post({ nope: true }));
      expect((await checkout({}, { ip: '203.0.113.99' })).status).toBe(201);
    });
  });

  describe('validation', () => {
    it.each([
      ['unitCents on a line', (b: Record<string, unknown>) => ({ ...b, lines: [{ itemId: 'x', quantity: 1, unitCents: 1 }] })],
      ['price on a line', (b: Record<string, unknown>) => ({ ...b, lines: [{ itemId: 'x', quantity: 1, price: '1.00' }] })],
      ['totalCents at the top', (b: Record<string, unknown>) => ({ ...b, totalCents: 1 })],
      ['price at the top', (b: Record<string, unknown>) => ({ ...b, price: 1 })],
      ['no lines', (b: Record<string, unknown>) => ({ ...b, lines: [] })],
      ['16 lines', (b: Record<string, unknown>) => ({ ...b, lines: Array.from({ length: 16 }, (_, i) => ({ itemId: `i${i}`, quantity: 1 })) })],
      ['quantity 0', (b: Record<string, unknown>) => ({ ...b, lines: [{ itemId: 'x', quantity: 0 }] })],
      ['quantity 21', (b: Record<string, unknown>) => ({ ...b, lines: [{ itemId: 'x', quantity: 21 }] })],
      ['a fractional quantity', (b: Record<string, unknown>) => ({ ...b, lines: [{ itemId: 'x', quantity: 1.5 }] })],
      ['a note over 280', (b: Record<string, unknown>) => ({ ...b, note: 'x'.repeat(281) })],
      ['a fractional total', (b: Record<string, unknown>) => ({ ...b, expectedTotalCents: 9.5 })],
      ['no total', (b: Record<string, unknown>) => ({ ...b, expectedTotalCents: undefined })],
      ['a short request id', (b: Record<string, unknown>) => ({ ...b, requestId: 'short' })],
      ['a long request id', (b: Record<string, unknown>) => ({ ...b, requestId: 'x'.repeat(65) })],
      ['an unknown fulfilment', (b: Record<string, unknown>) => ({ ...b, fulfillment: 'drone' })],
    ])('refuses %s with a 400', async (_what, change) => {
      const res = await send(post(change(body())));
      expect(res.status).toBe(400);
      expect((await failure(res)).code).toBe('INVALID_ORDER');
      expect(createCalls()).toHaveLength(0);
    });

    it('refuses broken JSON with a 400', async () => {
      expect((await send(post('{not json'))).status).toBe(400);
    });

    it('refuses a body over the cap with a 413', async () => {
      expect((await send(post({ ...body(), note: 'x'.repeat(70_000) }))).status).toBe(413);
    });
  });

  describe('the shop', () => {
    it.each([['missing', 'no-such-shop-here']])('is a 404 when %s', async (_w, slug) => {
      const res = await send(post(body(), { slug }), slug);
      expect(res.status).toBe(404);
      expect((await failure(res)).code).toBe('SHOP_NOT_FOUND');
    });

    it('is a 404 while a draft', async () => {
      const draft = shops.create(getDb(), { name: `Draft Bakery ${Date.now()}`, about: '', fulfillment: 'pickup', shippingFeeCents: 0, pickupNotes: '' }).shop;
      expect((await send(post(body(), { slug: draft.slug }), draft.slug)).status).toBe(404);
    });

    it('says a paused shop isn’t taking orders, and keeps the items', async () => {
      shops.update(getDb(), s.shop.id, { status: 'paused' });
      const res = await checkout();
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('SHOP_NOT_ACCEPTING_ORDERS');
      expect(e.message).toBe(`${s.shop.name} isn’t taking orders right now. Your items are saved here.`);
      expect(createCalls()).toHaveLength(0);
    });
  });

  describe('prices', () => {
    it('answers PRICE_CHANGED with no PayPal call when the total differs', async () => {
      const res = await checkout({ expectedTotalCents: 900 });
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('PRICE_CHANGED');
      expect(e.message).toBe('Prices changed. Check your total, then try again.');
      expect(createCalls()).toHaveLength(0);
      expect(orders.listByShop(getDb(), s.shop.id)).toHaveLength(0);
    });

    it('answers PRICE_CHANGED when a retry would return an order at the old price', async () => {
      await checkout();
      const almond = s.item['Almond croissant'];
      getDb().prepare('UPDATE variants SET price_cents = 500 WHERE id = ?').run(almond.variants[0].id);
      const res = await checkout({ expectedTotalCents: 1000 });
      expect(res.status).toBe(409);
      expect((await failure(res)).code).toBe('PRICE_CHANGED');
      expect(createCalls()).toHaveLength(1);
    });
  });

  describe('retries', () => {
    it('returns the same order for the same request id, with one PayPal call', async () => {
      const a = (await (await checkout()).json()) as Success;
      const again = await checkout();
      expect(again.status).toBe(201);
      expect(((await again.json()) as Success).orderRef).toBe(a.orderRef);
      expect(createCalls()).toHaveLength(1);
    });

    it('answers IDEMPOTENCY_CONFLICT when the note changed on the same request id', async () => {
      await checkout({ note: 'No nuts please' });
      const res = await checkout({ note: 'Extra nuts' });
      expect(res.status).toBe(409);
      expect((await failure(res)).code).toBe('IDEMPOTENCY_CONFLICT');
      expect(createCalls()).toHaveLength(1);
    });

    it('answers IDEMPOTENCY_CONFLICT when the note was removed on the same request id', async () => {
      await checkout({ note: 'No nuts please' });
      expect((await failure(await checkout())).code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('answers IDEMPOTENCY_CONFLICT when the lines changed on the same request id', async () => {
      await checkout();
      const res = await checkout({ lines: [{ itemId: s.item['Almond croissant'].id, quantity: 3 }], expectedTotalCents: 1425 });
      expect((await failure(res)).code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('answers CHECKOUT_STALE when the stored order has moved on, and a new id makes a new order', async () => {
      const a = (await (await checkout()).json()) as Success;
      const order = orders.byId(getDb(), a.orderRef)!;
      fake.approve(order.paypalOrderId);
      expect((await syncOrder(getOrderDeps(), order.id, 'return_url')).status).toBe('paid');
      const res = await checkout();
      expect(res.status).toBe(409);
      expect((await failure(res)).code).toBe('CHECKOUT_STALE');
      expect(createCalls()).toHaveLength(1);
      const fresh = await checkout({ requestId: `request-${n}-0002` });
      expect(fresh.status).toBe(201);
      expect(((await fresh.json()) as Success).orderRef).not.toBe(a.orderRef);
    });

    it('answers CHECKOUT_STALE when the stored order’s window has passed, even before the poller marks it', async () => {
      const a = (await (await checkout()).json()) as Success;
      getDb().prepare('UPDATE orders SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1_000).toISOString(), a.orderRef);
      expect(orders.byId(getDb(), a.orderRef)!.status).toBe('awaiting_approval');
      expect((await failure(await checkout())).code).toBe('CHECKOUT_STALE');
    });
  });

  describe('things that can’t be ordered', () => {
    it('removes an item from another shop by name-free refusal', async () => {
      const other = seedShop(getDb(), { name: `Other Bakery ${n} ${Date.now()}` });
      const res = await checkout({ lines: [{ itemId: other.item['Almond croissant'].id, quantity: 1 }], expectedTotalCents: 475 });
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('UNKNOWN_ITEM');
      expect(e.itemId).toBe(other.item['Almond croissant'].id);
      expect(e.message).toBe('That item is no longer available, so we took it out.');
      expect(createCalls()).toHaveLength(0);
    });

    it('names a sold-out item and returns its id', async () => {
      const rye = s.item['Seeded rye'];
      const res = await checkout({ lines: [{ itemId: rye.id, quantity: 1 }], expectedTotalCents: 1050 });
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('ITEM_UNAVAILABLE');
      expect(e.itemId).toBe(rye.id);
      expect(e.message).toBe('Seeded rye is no longer available, so we took it out.');
    });

    it('says a removed item’s name, since the shop still knows it', async () => {
      items.update(getDb(), s.item['Sourdough loaf'].id, { status: 'removed' });
      const res = await checkout({ lines: [{ itemId: s.item['Sourdough loaf'].id, quantity: 1 }], expectedTotalCents: 900 });
      const e = await failure(res);
      expect(e.code).toBe('UNKNOWN_ITEM');
      expect(e.message).toBe('Sourdough loaf is no longer available, so we took it out.');
    });

    it('states the cap in dollars when the order is too large', async () => {
      shops.update(getDb(), s.shop.id, { orderCapCents: 500 });
      const res = await checkout();
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('ORDER_TOO_LARGE');
      expect(e.message).toBe('This shop takes online orders up to $5.00.');
    });

    it('asks for a fulfilment when a two-way shop gets none', async () => {
      const res = await send(post(body({ fulfillment: undefined })));
      expect(res.status).toBe(400);
      expect((await failure(res)).code).toBe('FULFILLMENT_REQUIRED');
    });
  });

  describe('open-order limits have their own copy', () => {
    const fresh = (i: number) => `request-${n}-${String(i).padStart(4, '0')}`;

    it('tells the buyer when it’s their own orders', async () => {
      for (let i = 0; i < MAX_OPEN_ORDERS_PER_CLIENT; i++) expect((await checkout({ requestId: fresh(i) })).status).toBe(201);
      const res = await checkout({ requestId: fresh(9) });
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('TOO_MANY_OPEN_ORDERS');
      expect(e.scope).toBe('client');
      expect(e.message).toBe('You have orders waiting for payment here. Pay one, or try again in an hour.');
    });

    it('doesn’t blame the buyer when the shop is full', async () => {
      for (let i = 0; i < MAX_OPEN_ORDERS_PER_SHOP; i++) {
        expect((await checkout({ requestId: fresh(i) }, { ip: `198.51.100.${i + 1}` })).status).toBe(201);
      }
      const res = await checkout({ requestId: fresh(99) });
      expect(res.status).toBe(409);
      const e = await failure(res);
      expect(e.code).toBe('TOO_MANY_OPEN_ORDERS');
      expect(e.scope).toBe('shop');
      expect(e.message).toBe(`${s.shop.name} has a lot of orders waiting for payment right now. Try again in a few minutes. Your items are saved here.`);
      expect(e.message).not.toMatch(/\byou\b/i);
    });
  });

  describe('PayPal', () => {
    it('reports an outage in the buyer’s words and stores nothing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fake.failNext('createOrder', new PayPalApiError(503, 'SERVICE_UNAVAILABLE', null, 'dbg', 'down'));
      const res = await checkout();
      warn.mockRestore();
      expect(res.status).toBe(502);
      const e = await failure(res);
      expect(e.code).toBe('PAYPAL_UNAVAILABLE');
      expect(e.message).toBe('We can’t reach PayPal right now. Your order is saved here. Try again in a moment.');
      expect(orders.listByShop(getDb(), s.shop.id)).toHaveLength(0);
    });
  });
});
