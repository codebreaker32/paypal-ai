// Owner routes: GET orders, POST fulfil, POST tracking (stub toolkit behind the real scoped wrapper).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import * as events from '@/lib/db/repos/events';
import type { Order, OrderLine, Shop } from '@/lib/domain/types';
import type { ToolkitLike } from '@/lib/paypal/toolkit';
import { createFakePayPal } from '@/lib/paypal/fake';
import { setPayPalForServices } from '@/lib/services';
import { paypalLooksUnreachable } from '@/lib/seller/health';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const h = vi.hoisted(() => ({
  owned: new Set<string>(),
  createTracking: null as null | ((args: Record<string, unknown>) => Promise<string>),
  boom: false,
}));

vi.mock('@/lib/seller/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/seller/actions')>();
  const guard = <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A): R => {
    if (h.boom) throw new Error('database is locked: /secret/path');
    return fn(...a);
  };
  return { ...actual, markPickedUp: guard(actual.markPickedUp), addTracking: guard(actual.addTracking) };
});

vi.mock('@/lib/auth/owner', async () => {
  const shops = await import('@/lib/db/repos/shops');
  const { getDb: db } = await import('@/lib/db');
  return {
    getOwnedShop: vi.fn(async (id: string) => (h.owned.has(id) ? shops.byId(db(), id) : null)),
    requireOwner: vi.fn(),
  };
});

vi.mock('@/lib/paypal/toolkit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paypal/toolkit')>();
  const tk: ToolkitLike = {
    getTools: () => ({
      get_order: {
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }: { id: string }) =>
          JSON.stringify({ id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPROUTE1', status: 'COMPLETED' }] } }] }),
      },
      create_shipment_tracking: {
        parameters: z.object({}).passthrough(),
        execute: async (args: Record<string, unknown>) => h.createTracking!(args),
      },
    }),
  };
  return { ...actual, createSellerToolkit: (scope: Parameters<typeof actual.createSellerToolkit>[0]) => actual.createSellerToolkit(scope, { factory: () => tk }) };
});

const params = (id: string, orderId?: string) => ({ params: Promise.resolve(orderId ? { id, orderId } : { id }) }) as never;
const post = (body?: unknown) =>
  new Request('http://localhost:3000/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

let seq = 0;
function placeOrder(s: SeededShop, opts: { fulfillment?: 'pickup' | 'shipping'; paid?: boolean } = {}): Order {
  const db = getDb();
  const it = s.item['Sourdough loaf'];
  const line: OrderLine = { itemId: it.id, variantId: it.variants[0].id, name: it.name, label: null, unitCents: 900, qty: 1, paypalProductId: it.paypalProductId };
  const fulfillment = opts.fulfillment ?? 'shipping';
  const o = orders.insert(
    db,
    {
      shopId: s.shop.id, fulfillment, buyerName: null, buyerNote: null, agentName: 'Claude', clientRequestId: null,
      itemsCents: 900, shippingCents: fulfillment === 'shipping' ? 800 : 0, totalCents: fulfillment === 'shipping' ? 1700 : 900,
      paypalOrderId: `PPR${process.pid}${String(++seq).padStart(8, '0')}`, approvalUrl: 'https://example.test/approve',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    [line],
  );
  if (opts.paid !== false) orders.casStatus(db, o.id, 'awaiting_approval', 'paid', { paidAt: new Date().toISOString(), captureId: 'CAPROUTE1' });
  return orders.byId(db, o.id)!;
}

describe('owner order routes', () => {
  let s: SeededShop;
  let stranger: Shop;
  let ordersRoute: typeof import('@/app/api/shops/[id]/orders/route');
  let fulfilRoute: typeof import('@/app/api/shops/[id]/orders/[orderId]/fulfil/route');
  let trackingRoute: typeof import('@/app/api/shops/[id]/orders/[orderId]/tracking/route');

  beforeAll(async () => {
    process.env.DATABASE_PATH = tempDbPath('seller-routes');
    setPayPalForServices(createFakePayPal());
    s = seedShop(getDb(), { name: `Route Owner Bakery ${Date.now()}` });
    stranger = seedShop(getDb(), { name: `Not Yours ${Date.now()}` }).shop;
    ordersRoute = await import('@/app/api/shops/[id]/orders/route');
    fulfilRoute = await import('@/app/api/shops/[id]/orders/[orderId]/fulfil/route');
    trackingRoute = await import('@/app/api/shops/[id]/orders/[orderId]/tracking/route');
  });

  beforeEach(() => {
    h.owned = new Set([s.shop.id]);
    h.createTracking = vi.fn(async () => JSON.stringify({ tracker_identifiers: [{ transaction_id: 'CAPROUTE1' }], errors: [] }));
  });

  it('every route runs in the Node runtime', () => {
    expect([ordersRoute.runtime, fulfilRoute.runtime, trackingRoute.runtime]).toEqual(['nodejs', 'nodejs', 'nodejs']);
  });

  describe('GET /api/shops/[id]/orders', () => {
    it("returns the shop's orders newest first, read from the database only", async () => {
      const a = placeOrder(s);
      const b = placeOrder(s, { fulfillment: 'pickup', paid: false });
      placeOrder({ ...s, shop: stranger });
      getDb().prepare('UPDATE orders SET created_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', a.id);

      const res = await ordersRoute.GET(new Request('http://localhost/x'), params(s.shop.id));

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const body = await res.json();
      const ids = body.orders.map((o: Order) => o.id);
      expect(ids[0]).toBe(b.id);
      expect(ids.at(-1)).toBe(a.id);
      expect(body.orders.every((o: Order) => o.shopId === s.shop.id)).toBe(true);
      expect(typeof body.paypalReachable).toBe('boolean');
    });

    it("is a JSON 404 for someone who doesn't own the shop", async () => {
      const res = await ordersRoute.GET(new Request('http://localhost/x'), params(stranger.id));
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/shops/[id]/orders/[orderId]/fulfil', () => {
    it('marks a paid pickup order picked up', async () => {
      const o = placeOrder(s, { fulfillment: 'pickup' });
      const res = await fulfilRoute.POST(post(), params(s.shop.id, o.id));
      expect(res.status).toBe(200);
      expect((await res.json()).order.status).toBe('fulfilled');
    });

    it('refuses a shipping order (409) and a non-owner (404)', async () => {
      const o = placeOrder(s);
      expect((await fulfilRoute.POST(post(), params(s.shop.id, o.id))).status).toBe(409);
      h.owned = new Set();
      const p = placeOrder(s, { fulfillment: 'pickup' });
      expect((await fulfilRoute.POST(post(), params(s.shop.id, p.id))).status).toBe(404);
      expect(orders.byId(getDb(), p.id)!.status).toBe('paid');
    });
  });

  describe('unexpected errors keep the { error: { code, message } } contract', () => {
    it('fulfil and tracking answer 500 INTERNAL without leaking the cause', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const o = placeOrder(s, { fulfillment: 'pickup' });
      h.boom = true;
      try {
        const a = await fulfilRoute.POST(post(), params(s.shop.id, o.id));
        expect(a.status).toBe(500);
        const ab = await a.json();
        expect(ab.error.code).toBe('INTERNAL');
        expect(JSON.stringify(ab)).not.toContain('secret');
        const b = await trackingRoute.POST(post({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' }), params(s.shop.id, o.id));
        expect(b.status).toBe(500);
        expect((await b.json()).error.code).toBe('INTERNAL');
        expect(log).toHaveBeenCalled();
      } finally {
        h.boom = false;
        log.mockRestore();
      }
    });
  });

  describe('POST /api/shops/[id]/orders/[orderId]/tracking', () => {
    it('sends tracking to PayPal and returns the fulfilled order with its tracker', async () => {
      const o = placeOrder(s);
      const res = await trackingRoute.POST(post({ carrier: 'USPS', trackingNumber: '9400 1118 9922 3100 0000 00' }), params(s.shop.id, o.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order.status).toBe('fulfilled');
      expect(body.trackers).toEqual([expect.objectContaining({ carrier: 'USPS', trackingNumber: '9400111899223100000000' })]);
      expect(h.createTracking).toHaveBeenCalledWith(expect.objectContaining({ order_id: o.paypalOrderId, transaction_id: 'CAPROUTE1', carrier: 'USPS' }));
      expect(events.list(getDb(), o.id).at(-1)?.type).toBe('tracking_added');
    });

    it('400 for a bad body, nothing sent to PayPal', async () => {
      const o = placeOrder(s);
      const res = await trackingRoute.POST(post({ carrier: 'USPS' }), params(s.shop.id, o.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_TRACKING');
      expect(h.createTracking).not.toHaveBeenCalled();
    });

    it("502 with PayPal's message when PayPal rejects it", async () => {
      const o = placeOrder(s);
      h.createTracking = vi.fn(async () =>
        JSON.stringify({ ok: false, status: 400, code: 'PAYPAL_API_HTTP_ERROR', message: 'Request is not well-formed: tracking_number is invalid' }),
      );
      const res = await trackingRoute.POST(post({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' }), params(s.shop.id, o.id));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error.code).toBe('PAYPAL_REJECTED');
      expect(body.error.message).toContain('tracking_number is invalid');
      expect(orders.byId(getDb(), o.id)!.status).toBe('paid');
    });

    it("404 for another shop's order, even for an owner", async () => {
      const foreign = placeOrder({ ...s, shop: stranger });
      const res = await trackingRoute.POST(post({ carrier: 'USPS', trackingNumber: '9400111899223100000000' }), params(s.shop.id, foreign.id));
      expect(res.status).toBe(404);
      expect(h.createTracking).not.toHaveBeenCalled();
    });
  });
});

describe('paypalLooksUnreachable', () => {
  it('flags open orders nobody has checked lately and recent capture errors; ignores settled orders', () => {
    const db = getDb();
    const s = seedShop(db, { name: `Health ${Date.now()}` });
    const now = Date.now();
    const fresh = placeOrder(s, { paid: false });
    expect(paypalLooksUnreachable(db, [fresh], now)).toBe(false);

    const old = new Date(now - 10 * 60_000).toISOString();
    db.prepare('UPDATE orders SET created_at = ?, last_checked_at = ? WHERE id = ?').run(old, old, fresh.id);
    expect(paypalLooksUnreachable(db, [orders.byId(db, fresh.id)!], now)).toBe(true);

    db.prepare('UPDATE orders SET last_checked_at = ? WHERE id = ?').run(new Date(now - 5_000).toISOString(), fresh.id);
    expect(paypalLooksUnreachable(db, [orders.byId(db, fresh.id)!], now)).toBe(false);
    events.add(db, fresh.id, 'capture_error', 'poller', { status: 503 });
    expect(paypalLooksUnreachable(db, [orders.byId(db, fresh.id)!], now)).toBe(true);

    // A payment still pending after the poller's 3 h window is not a sign that PayPal is unreachable.
    const slow = placeOrder(s, { paid: false });
    const longAgo = new Date(now - 4 * 60 * 60_000).toISOString();
    db.prepare("UPDATE orders SET status = 'payment_pending', created_at = ?, last_checked_at = ? WHERE id = ?").run(longAgo, longAgo, slow.id);
    expect(paypalLooksUnreachable(db, [orders.byId(db, slow.id)!], now)).toBe(false);

    const paid = placeOrder(s);
    db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run(old, paid.id);
    expect(paypalLooksUnreachable(db, [orders.byId(db, paid.id)!], now)).toBe(false);
  });
});
