// POST /api/paypal/webhook: verify, dedupe, map the resource to our order, re-sync from PayPal (payload never trusted).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import * as events from '@/lib/db/repos/events';
import { createFakePayPal } from '@/lib/paypal/fake';
import { setPayPalForServices, getOrderDeps } from '@/lib/services';
import { createOrderForShop, syncOrder } from '@/lib/orders/service';
import type { Order } from '@/lib/domain/types';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const h = vi.hoisted(() => ({ verify: vi.fn<(headers: Headers, raw: string, webhookId: string) => Promise<boolean>>(async () => true) }));

vi.mock('@/lib/paypal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paypal')>();
  return { ...actual, getPayPal: () => ({ verifyWebhookSignature: h.verify }) };
});
vi.mock('@/lib/orders/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/orders/service')>();
  return { ...actual, syncOrder: vi.fn(actual.syncOrder) };
});

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', `webhook-${name}.json`), 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SIG_HEADERS = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77',
  'paypal-transmission-id': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
  'paypal-transmission-sig': 'lmI95Jx3Y9nhR5SJWlHVIWpg4AgFk7n9bCHSRxbrd8A9zrhdu2rMyFrmz+Zjh3s3boXB07VXCXUZy/UFzUlnGJn0wDugt7FlSvdKeIJenLRemUxYCPVoEZzg9VFNqOa48gMkvF+XTpxBeUx/kWy6B5cp7GkT2+pOowfRK7OaynuxUoKW3JcMWw272VKjLTtTAShncla7tGF+55rxyt2KNZIIqxNMJ48RDZheGU5w1npu9dZHnPgTXB9iomeVRoD8O/jhRpnKsGrDschyNdkeh81BJJMH4Ctc6lnCCquoP/GzCzz33MMsNdid7vL/NIWaCsekQpW26FpWPi/tfj8nLA==',
  'paypal-transmission-time': '2026-11-06T18:21:51Z',
};

function deliver(body: unknown, opts: { raw?: string; headers?: Record<string, string> } = {}): Request {
  return new Request('http://localhost:3000/api/paypal/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...SIG_HEADERS, ...opts.headers },
    body: opts.raw ?? JSON.stringify(body),
  });
}

let counter = 0;
const eventId = () => `WH-TEST-${process.pid}-${Date.now()}-${++counter}`;

function approvedEvent(paypalOrderId: string, id = eventId()) {
  const e = fixture('order-approved');
  e.id = id;
  e.resource.id = paypalOrderId;
  return e;
}

function captureEvent(name: 'capture-completed' | 'capture-denied', paypalOrderId: string, id = eventId()) {
  const e = fixture(name);
  e.id = id;
  e.resource.supplementary_data.related_ids.order_id = paypalOrderId;
  return e;
}

describe('POST /api/paypal/webhook', () => {
  const fake = createFakePayPal();
  let s: SeededShop;
  let route: typeof import('@/app/api/paypal/webhook/route');
  let warn: ReturnType<typeof vi.spyOn>;

  const newOrder = (): Promise<Order> =>
    createOrderForShop(getOrderDeps(), s.shop, {
      lines: [{ itemId: s.item['Almond croissant'].id, quantity: 2 }, { itemId: s.item['Sourdough loaf'].id, quantity: 1 }],
      fulfillment: 'shipping',
      agentName: 'Claude',
    });

  beforeAll(async () => {
    process.env.DATABASE_PATH = tempDbPath('webhook');
    setPayPalForServices(fake);
    s = seedShop(getDb(), { name: `Webhook Bakery ${Date.now()}` });
    route = await import('@/app/api/paypal/webhook/route');
  });

  beforeEach(() => {
    vi.stubEnv('PAYPAL_WEBHOOK_ID', 'WH-ID-TEST');
    h.verify.mockReset();
    h.verify.mockResolvedValue(true);
    vi.mocked(syncOrder).mockClear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it('refuses a chunked body over 64 KB with 413, without buffering it (R2/R5)', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>(
        { pull: (c) => { pulled++; c.enqueue(new Uint8Array(16 * 1024).fill(0x20)); } },
        { highWaterMark: 0 },
      );
    const req = new Request('http://localhost:3000/api/paypal/webhook', { method: 'POST', headers: SIG_HEADERS, body, duplex: 'half' } as RequestInit);
    const res = await route.POST(req);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(6);
  });

  it('runs in the Node runtime', () => {
    expect(route.runtime).toBe('nodejs');
  });

  it('rejects a bad signature with 400 and does not record or process the event', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    h.verify.mockResolvedValue(false);
    const e = approvedEvent(o.paypalOrderId);

    const res = await route.POST(deliver(e));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('BAD_SIGNATURE');
    expect(syncOrder).not.toHaveBeenCalled();
    expect(orders.byId(getDb(), o.id)!.status).toBe('awaiting_approval');
    // Not recorded: the same event id delivered again with a good signature is processed.
    h.verify.mockResolvedValue(true);
    expect((await route.POST(deliver(e))).status).toBe(200);
    expect(syncOrder).toHaveBeenCalledTimes(1);
  });

  it('verifies with the raw body, the PayPal headers and PAYPAL_WEBHOOK_ID', async () => {
    const o = await newOrder();
    const raw = JSON.stringify(approvedEvent(o.paypalOrderId), null, 2);
    await route.POST(deliver(null, { raw }));
    expect(h.verify).toHaveBeenCalledTimes(1);
    const [headers, body, webhookId] = h.verify.mock.calls[0] as [Headers, string, string];
    expect(headers.get('paypal-transmission-id')).toBe(SIG_HEADERS['paypal-transmission-id']);
    expect(body).toBe(raw);
    expect(webhookId).toBe('WH-ID-TEST');
  });

  it('valid CHECKOUT.ORDER.APPROVED → syncOrder(…, "webhook") → paid', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId, { name: 'Dana Buyer', shipTo: { city: 'Austin', state: 'TX' } });

    const res = await route.POST(deliver(approvedEvent(o.paypalOrderId)));

    expect(res.status).toBe(200);
    expect(syncOrder).toHaveBeenCalledTimes(1);
    expect(syncOrder).toHaveBeenCalledWith(expect.anything(), o.id, 'webhook');
    const paid = orders.byId(getDb(), o.id)!;
    expect(paid.status).toBe('paid');
    expect(paid.shipTo?.city).toBe('Austin');
    const types = events.list(getDb(), o.id).filter((ev) => ev.source === 'webhook').map((ev) => ev.type);
    expect(types).toEqual(['paypal_approved', 'capture_completed']);
  });

  it('a duplicate event id is a 200 no-op', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    const e = approvedEvent(o.paypalOrderId);
    expect((await route.POST(deliver(e))).status).toBe(200);
    expect(syncOrder).toHaveBeenCalledTimes(1);

    const again = await route.POST(deliver(e));

    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true });
    expect(syncOrder).toHaveBeenCalledTimes(1);
  });

  it('never trusts the payload: an APPROVED event for an order PayPal has not approved changes nothing', async () => {
    const o = await newOrder(); // the fake still says PAYER_ACTION_REQUIRED; the fixture's resource says COMPLETED
    const res = await route.POST(deliver(approvedEvent(o.paypalOrderId)));
    expect(res.status).toBe(200);
    expect(syncOrder).toHaveBeenCalledWith(expect.anything(), o.id, 'webhook');
    expect(orders.byId(getDb(), o.id)!.status).toBe('awaiting_approval');
    expect(fake.calls.filter((c) => c.method === 'captureOrder' && c.args[0] === o.paypalOrderId)).toHaveLength(0);
  });

  it('PAYMENT.CAPTURE.COMPLETED finds the order through supplementary_data.related_ids.order_id', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    fake.nextCapture = 'PENDING';
    await syncOrder(getOrderDeps(), o.id, 'poller');
    expect(orders.byId(getDb(), o.id)!.status).toBe('payment_pending');
    fake.orders.get(o.paypalOrderId)!.purchase_units[0].payments!.captures![0].status = 'COMPLETED';
    vi.mocked(syncOrder).mockClear();

    const res = await route.POST(deliver(captureEvent('capture-completed', o.paypalOrderId)));

    expect(res.status).toBe(200);
    expect(syncOrder).toHaveBeenCalledWith(expect.anything(), o.id, 'webhook');
    expect(orders.byId(getDb(), o.id)!.status).toBe('paid');
  });

  it('PAYMENT.CAPTURE.DENIED on a pending payment → failed, read from PayPal', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    fake.nextCapture = 'PENDING';
    await syncOrder(getOrderDeps(), o.id, 'poller');
    fake.orders.get(o.paypalOrderId)!.purchase_units[0].payments!.captures![0].status = 'DECLINED';

    const res = await route.POST(deliver(captureEvent('capture-denied', o.paypalOrderId)));

    expect(res.status).toBe(200);
    expect(orders.byId(getDb(), o.id)!.status).toBe('failed');
  });

  it('an event for an order Shelfie does not know is acknowledged with 200', async () => {
    const res = await route.POST(deliver(approvedEvent('9ZZ99999ZZ9999999')));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: 'unknown_order' });
    expect(syncOrder).not.toHaveBeenCalled();
  });

  it('other event types are acknowledged and ignored', async () => {
    const e = { ...approvedEvent('1AA11111AA1111111'), event_type: 'CUSTOMER.DISPUTE.CREATED' };
    const res = await route.POST(deliver(e));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: 'event_type' });
    expect(syncOrder).not.toHaveBeenCalled();
  });

  it('a malformed body is a 400', async () => {
    const res = await route.POST(deliver(null, { raw: '{"id": "WH-1", "event_type": ' }));
    expect(res.status).toBe(400);
    const noId = await route.POST(deliver({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'X' } }));
    expect(noId.status).toBe(400);
  });

  it('PayPal unreachable during verification → 503 (PayPal retries) and nothing recorded', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    h.verify.mockRejectedValue(new Error('ECONNRESET'));
    const e = approvedEvent(o.paypalOrderId);
    expect((await route.POST(deliver(e))).status).toBe(503);
    h.verify.mockResolvedValue(true);
    expect((await route.POST(deliver(e))).status).toBe(200);
    expect(orders.byId(getDb(), o.id)!.status).toBe('paid');
  });

  it('a sync failure is a 503 and the event is not deduped, so PayPal redelivery is processed', async () => {
    const o = await newOrder();
    fake.approve(o.paypalOrderId);
    const e = approvedEvent(o.paypalOrderId);
    fake.failNext('getOrder', new Error('socket hang up'));
    const res = await route.POST(deliver(e));
    expect(res.status).toBe(503);
    expect(warn).toHaveBeenCalled();
    const again = await route.POST(deliver(e));
    expect(again.status).toBe(200);
    expect(await again.json()).not.toMatchObject({ duplicate: true });
    expect(orders.byId(getDb(), o.id)!.status).toBe('paid');
  });

  it('missing paypal-transmission headers → 400 without calling PayPal', async () => {
    const o = await newOrder();
    const res = await route.POST(new Request('http://localhost:3000/api/paypal/webhook', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(approvedEvent(o.paypalOrderId)),
    }));
    expect(res.status).toBe(400);
    expect(h.verify).not.toHaveBeenCalled();
    expect(syncOrder).not.toHaveBeenCalled();
  });

  it('in production, an unset PAYPAL_WEBHOOK_ID → 503', async () => {
    vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
    vi.stubEnv('NODE_ENV', 'production');
    const o = await newOrder();
    const res = await route.POST(deliver(approvedEvent(o.paypalOrderId)));
    expect(res.status).toBe(503);
    expect(h.verify).not.toHaveBeenCalled();
    expect(syncOrder).not.toHaveBeenCalled();
  });

  it('in development, an unset PAYPAL_WEBHOOK_ID skips verification with one warning', async () => {
    vi.resetModules();
    const fresh = await import('@/app/api/paypal/webhook/route');
    const { syncOrder: freshSync } = await import('@/lib/orders/service');
    vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
    vi.stubEnv('NODE_ENV', 'development');
    const a = await newOrder();
    const b = await newOrder();
    fake.approve(a.paypalOrderId);

    expect((await fresh.POST(deliver(approvedEvent(a.paypalOrderId)))).status).toBe(200);
    expect((await fresh.POST(deliver(approvedEvent(b.paypalOrderId)))).status).toBe(200);

    expect(h.verify).not.toHaveBeenCalled();
    expect(freshSync).toHaveBeenCalledTimes(2);
    expect(orders.byId(getDb(), a.id)!.status).toBe('paid');
    const skipped = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('PAYPAL_WEBHOOK_ID'));
    expect(skipped).toHaveLength(1);
  });
});
