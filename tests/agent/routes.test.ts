// Buyer-side routes: PayPal return/cancel, the receipt's order read, the console route and the menu photo route.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import type { Order } from '@/lib/domain/types';
import { createOrderForShop, type OrderDeps } from '@/lib/orders/service';
import { createFakePayPal } from '@/lib/paypal/fake';
import { resetRateLimits } from '@/lib/rate-limit';
import { setPayPalForServices } from '@/lib/services';
import { GET as returnGET, runtime as returnRuntime } from '@/app/api/paypal/return/route';
import { GET as cancelGET, runtime as cancelRuntime } from '@/app/api/paypal/cancel/route';
import { GET as orderGET, runtime as orderRuntime } from '@/app/api/orders/[ref]/route';
import { POST as assistantPOST, runtime as assistantRuntime } from '@/app/api/assistant/[slug]/route';
import { GET as photoGET, runtime as photoRuntime } from '@/app/s/[slug]/photo/[n]/route';
import { seedShop, type SeededShop } from '../helpers/shop';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-buyer-routes-'));
const fake = createFakePayPal();
let s: SeededShop;
let deps: OrderDeps;

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(tmp, 'test.db');
  process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
  process.env.APP_URL = 'http://localhost:3102';
  setPayPalForServices(fake);
  s = seedShop(getDb(), { name: `Buyer Routes Bakery ${Date.now()}` });
  deps = { db: getDb(), paypal: fake, appUrl: 'http://localhost:3102' };
});

afterAll(() => {
  setPayPalForServices(undefined);
  fs.rmSync(tmp, { recursive: true, force: true });
});

const shipTwoCroissants = (key: string): Promise<Order> =>
  createOrderForShop(deps, s.shop, {
    lines: [{ itemId: s.item['Almond croissant'].id, quantity: 2 }, { itemId: s.item['Sourdough loaf'].id, quantity: 1 }],
    fulfillment: 'shipping',
    agentName: 'shelfie-assistant',
    clientRequestId: key,
  });

const get = (url: string) => new Request(`http://localhost:3102${url}`);
const refCtx = (ref: string) => ({ params: Promise.resolve({ ref }) });

describe('route handlers run in the Node runtime', () => {
  it.each([
    ['return', returnRuntime],
    ['cancel', cancelRuntime],
    ['order', orderRuntime],
    ['assistant', assistantRuntime],
    ['photo', photoRuntime],
  ])('%s', (_name, rt) => expect(rt).toBe('nodejs'));
});

describe('GET /api/paypal/return', () => {
  it('syncs with PayPal (approved → captured → paid) and redirects to the receipt with 303', async () => {
    const order = await shipTwoCroissants('ret-1');
    fake.approve(order.paypalOrderId, { name: 'Dana Buyer', shipTo: { city: 'Austin', state: 'TX' } });
    const res = await returnGET(get(`/api/paypal/return?o=${order.id}&token=${order.paypalOrderId}&PayerID=ABC`));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/o/${order.id}`);
    const after = orders.byId(getDb(), order.id)!;
    expect(after.status).toBe('paid');
    expect(eventsRepo.list(getDb(), order.id).some((e) => e.source === 'return_url' && e.type === 'capture_completed')).toBe(true);
  });

  it('still redirects to the receipt when PayPal is unreachable (the poller catches up)', async () => {
    const order = await shipTwoCroissants('ret-2');
    fake.failNext('getOrder', new Error('network down'));
    const res = await returnGET(get(`/api/paypal/return?o=${order.id}`));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/o/${order.id}`);
    expect(orders.byId(getDb(), order.id)!.status).toBe('awaiting_approval');
  });

  it('redirects an unknown order to its receipt URL (which says it can’t be found)', async () => {
    const res = await returnGET(get('/api/paypal/return?o=ord_doesnotexist'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/o/ord_doesnotexist');
  });

  it('sends a request without an order reference home', async () => {
    const res = await returnGET(get('/api/paypal/return'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
  });

  it('never puts anything but a plain order reference into the redirect', async () => {
    const res = await returnGET(get(`/api/paypal/return?o=${encodeURIComponent('//evil.example/x')}`));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
  });
});

describe('GET /api/paypal/cancel', () => {
  it('cancels an order waiting for approval and redirects to the receipt', async () => {
    const order = await shipTwoCroissants('can-1');
    const res = await cancelGET(get(`/api/paypal/cancel?o=${order.id}&token=${order.paypalOrderId}`));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/o/${order.id}`);
    expect(orders.byId(getDb(), order.id)!.status).toBe('cancelled');
  });

  it('leaves a paid order alone', async () => {
    const order = await shipTwoCroissants('can-2');
    fake.approve(order.paypalOrderId);
    await returnGET(get(`/api/paypal/return?o=${order.id}`));
    const res = await cancelGET(get(`/api/paypal/cancel?o=${order.id}`));
    expect(res.status).toBe(303);
    expect(orders.byId(getDb(), order.id)!.status).toBe('paid');
  });

  it('redirects an unknown order to its receipt URL', async () => {
    const res = await cancelGET(get('/api/paypal/cancel?o=ord_nope'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/o/ord_nope');
  });
});

describe('GET /api/orders/[ref]', () => {
  it('returns the receipt view from SQLite only (no PayPal call), with the approval link while awaiting', async () => {
    const order = await shipTwoCroissants('get-1');
    const before = fake.calls.length;
    const res = await orderGET(get(`/api/orders/${order.id}`), refCtx(order.id));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = await res.json();
    expect(body).toEqual({
      order: {
        number: order.number,
        status: 'awaiting_approval',
        totalCents: 475 * 2 + 900 + 800,
        itemsCents: 475 * 2 + 900,
        shippingCents: 800,
        shopName: s.shop.name,
        shopSlug: s.shop.slug,
        fulfillment: 'shipping',
        approvalUrl: order.approvalUrl,
        paidAt: null,
        declined: false,
        lines: [
          { name: 'Almond croissant', label: null, qty: 2, unitCents: 475 },
          { name: 'Sourdough loaf', label: null, qty: 1, unitCents: 900 },
        ],
      },
    });
    expect(fake.calls.length).toBe(before);
  });

  it('hides the approval link once the order is paid', async () => {
    const order = await shipTwoCroissants('get-2');
    fake.approve(order.paypalOrderId);
    await returnGET(get(`/api/paypal/return?o=${order.id}`));
    const body = await (await orderGET(get(`/api/orders/${order.id}`), refCtx(order.id))).json();
    expect(body.order.status).toBe('paid');
    expect(body.order.approvalUrl).toBeNull();
    expect(body.order.paidAt).toEqual(expect.any(String));
  });

  it('marks an order whose payment method was declined', async () => {
    const order = await shipTwoCroissants('get-3');
    fake.approve(order.paypalOrderId);
    fake.nextCapture = 'DECLINED_422';
    await returnGET(get(`/api/paypal/return?o=${order.id}`));
    const body = await (await orderGET(get(`/api/orders/${order.id}`), refCtx(order.id))).json();
    expect(body.order.status).toBe('awaiting_approval');
    expect(body.order.declined).toBe(true);
    expect(body.order.approvalUrl).toBe(order.approvalUrl);
  });

  it('answers 404 with a coded error for an unknown order', async () => {
    const res = await orderGET(get('/api/orders/ord_nope'), refCtx('ord_nope'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'ORDER_NOT_FOUND', message: expect.any(String) } });
  });
});

describe('POST /api/assistant/[slug]', () => {
  const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
  const post = (slug: string, body: unknown, ip = '198.51.100.7') =>
    new Request(`http://localhost:3102/api/assistant/${slug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const saved = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    resetRateLimits();
    // Unit tests never call Claude: without a key the console answers with one error event.
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  });

  it('streams NDJSON console events (no key → one error event pointing at the agent door)', async () => {
    const res = await assistantPOST(post(s.shop.slug, { text: 'Two almond croissants, shipped to me' }), slugCtx(s.shop.slug));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toEqual([{ type: 'error', message: expect.stringMatching(/agent door/) }]);
  });

  it.each([
    ['empty text', { text: '   ' }],
    ['text over 500 characters', { text: 'x'.repeat(501) }],
    ['a missing text', { sessionId: 'asst_x' }],
    ['a non-string session id', { text: 'hi', sessionId: 42 }],
    ['an unknown key', { text: 'hi', price: '0.01' }],
    ['malformed JSON', '{"text":'],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await assistantPOST(post(s.shop.slug, body), slugCtx(s.shop.slug));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_MESSAGE');
  });

  it('answers 404 for an unknown or draft shop', async () => {
    const unknown = await assistantPOST(post('no-such-shop', { text: 'hi' }), slugCtx('no-such-shop'));
    expect(unknown.status).toBe(404);
    const draft = shops.create(getDb(), { name: `Draft Console ${Date.now()}` }).shop;
    const res = await assistantPOST(post(draft.slug, { text: 'hi' }), slugCtx(draft.slug));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('SHOP_NOT_FOUND');
  });

  it('allows 20 turns per IP per hour, then answers 429', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await assistantPOST(post(s.shop.slug, { text: `hi ${i}` }, '203.0.113.50'), slugCtx(s.shop.slug));
      expect(res.status).toBe(200);
      await res.text();
    }
    const limited = await assistantPOST(post(s.shop.slug, { text: 'one more' }, '203.0.113.50'), slugCtx(s.shop.slug));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('RATE_LIMITED');
    const otherIp = await assistantPOST(post(s.shop.slug, { text: 'hi' }, '203.0.113.51'), slugCtx(s.shop.slug));
    expect(otherIp.status).toBe(200);
  });
});

describe('GET /s/[slug]/photo/[n]', () => {
  const photoCtx = (slug: string, n: string) => ({ params: Promise.resolve({ slug, n }) });
  const jpeg = fs.readFileSync(path.join(process.cwd(), 'public/samples/marigold-bakehouse.jpg'));

  beforeAll(() => {
    const dir = path.join(process.env.UPLOADS_DIR!, s.shop.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'page-1.jpg'), jpeg);
    fs.writeFileSync(path.join(dir, 'page-2.jpg'), jpeg);
    fs.writeFileSync(path.join(tmp, 'secret.txt'), 'not a photo');
    shops.update(getDb(), s.shop.id, {
      menuPhotoPaths: [
        `${s.shop.id}/page-1.jpg`, // relative to UPLOADS_DIR
        path.join(process.env.UPLOADS_DIR!, s.shop.id, 'page-2.jpg'), // absolute, inside UPLOADS_DIR
        '../secret.txt', // outside UPLOADS_DIR: never served
        path.relative(process.cwd(), path.join(process.env.UPLOADS_DIR!, s.shop.id, 'page-1.jpg')), // relative to the app folder
      ],
    });
  });

  it('serves the original menu photo of a live shop', async () => {
    const res = await photoGET(get(`/s/${s.shop.slug}/photo/1`), photoCtx(s.shop.slug, '1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer()).equals(jpeg)).toBe(true);
    for (const n of ['2', '4']) {
      const res = await photoGET(get(`/s/${s.shop.slug}/photo/${n}`), photoCtx(s.shop.slug, n));
      expect(res.status).toBe(200);
    }
  });

  it.each(['0', '5', 'abc', '1.5', '-1', '100'])('answers 404 for photo %s', async (n) => {
    const res = await photoGET(get(`/s/${s.shop.slug}/photo/${n}`), photoCtx(s.shop.slug, n));
    expect(res.status).toBe(404);
  });

  it('never serves a file outside the uploads folder', async () => {
    const res = await photoGET(get(`/s/${s.shop.slug}/photo/3`), photoCtx(s.shop.slug, '3'));
    expect(res.status).toBe(404);
  });

  it('answers 404 for draft and unknown shops', async () => {
    const draft = shops.create(getDb(), { name: `Draft Photo ${Date.now()}`, menuPhotoPaths: [`${s.shop.id}/page-1.jpg`] }).shop;
    expect((await photoGET(get(`/s/${draft.slug}/photo/1`), photoCtx(draft.slug, '1'))).status).toBe(404);
    expect((await photoGET(get('/s/nope/photo/1'), photoCtx('nope', '1'))).status).toBe(404);
  });
});
