import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as events from '@/lib/db/repos/events';
import { createFakePayPal, type FakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError, type CreatePayPalOrderInput } from '@/lib/paypal/types';
import { cancelOrder, createOrderForShop, markFulfilled, syncOrder, type OrderDeps } from '@/lib/orders/service';
import { isPollerRunning, pollOnce, startPoller, stopPoller } from '@/lib/orders/poller';
import { OrderError } from '@/lib/orders/errors';
import { InvalidTransition } from '@/lib/orders/state';
import type { Order } from '@/lib/domain/types';
import { seedShop, type SeededShop } from '../helpers/shop';

const APP = 'http://localhost:3000';
const MIN = 60_000;

async function rejection(p: Promise<unknown>): Promise<OrderError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof OrderError) return e;
    throw e;
  }
  throw new Error('expected an OrderError');
}

describe('order service', () => {
  let db: Db;
  let fake: FakePayPal;
  let s: SeededShop;
  let clock: number;
  let deps: OrderDeps;
  const calls = (m: string) => fake.calls.filter((c) => c.method === m);

  beforeEach(() => {
    db = createTestDb();
    fake = createFakePayPal();
    s = seedShop(db);
    clock = Date.now();
    deps = { db, paypal: fake, appUrl: APP, now: () => clock };
  });

  const order = (over: Partial<Parameters<typeof createOrderForShop>[2]> = {}) =>
    createOrderForShop(deps, s.shop, {
      lines: [{ itemId: s.item['Almond croissant'].id, quantity: 2 }, { itemId: s.item['Sourdough loaf'].id, quantity: 1 }],
      fulfillment: 'shipping',
      buyerName: 'Dana',
      buyerNote: 'Nut allergy in the house',
      agentName: 'claude-code',
      ...over,
    });

  describe('createOrderForShop', () => {
    it('creates a PayPal order from database rows only and stores the snapshot', async () => {
      const coffee = s.item['Drip coffee'];
      const o = await order({ lines: [
        { itemId: s.item['Almond croissant'].id, quantity: 2 },
        { itemId: coffee.id, optionId: coffee.variants[1].id, quantity: 1 },
      ] });
      expect(o.status).toBe('awaiting_approval');
      expect(o.id).toMatch(/^ord_[a-z2-7]{16}$/);
      expect(o.number).toMatch(/^SHF-/);
      expect(o.itemsCents).toBe(1350);
      expect(o.shippingCents).toBe(800);
      expect(o.totalCents).toBe(2150);
      expect(o.fulfillment).toBe('shipping');
      expect(o.agentName).toBe('claude-code');
      expect(o.expiresAt).toBe(new Date(clock + 60 * MIN).toISOString());
      expect(o.approvalUrl).toContain('sandbox.paypal.com');
      expect(o.lines.map((l) => [l.name, l.label, l.unitCents, l.qty])).toEqual([['Almond croissant', null, 475, 2], ['Drip coffee', 'L', 400, 1]]);

      const [create] = calls('createOrder');
      const [input, requestId] = create.args as [CreatePayPalOrderInput, string];
      expect(requestId).toBe(`ord-${o.id}`);
      expect(input).toEqual({
        shopName: 'Marigold Bakehouse',
        orderId: o.id,
        orderNumber: o.number,
        items: [
          { name: 'Almond croissant', unitCents: 475, qty: 2, sku: s.item['Almond croissant'].paypalProductId, kind: 'PHYSICAL' },
          { name: 'Drip coffee (L)', unitCents: 400, qty: 1, sku: coffee.paypalProductId, kind: 'PHYSICAL' },
        ],
        shippingCents: 800,
        fulfillment: 'shipping',
        returnUrl: `${APP}/api/paypal/return?o=${o.id}`,
        cancelUrl: `${APP}/api/paypal/cancel?o=${o.id}`,
      });
      expect(fake.orders.get(o.paypalOrderId)?.purchase_units[0].amount?.value).toBe('21.50');
      const ev = events.list(db, o.id);
      expect(ev.map((e) => [e.type, e.source])).toEqual([['created', 'mcp']]);
    });

    it('is idempotent by clientRequestId: one PayPal call, same order', async () => {
      const a = await order({ clientRequestId: 'req-1' });
      const b = await order({ clientRequestId: 'req-1' });
      expect(b.id).toBe(a.id);
      expect(calls('createOrder')).toHaveLength(1);
      expect(calls('createOrder')[0].args[1]).toBe(`ord-${a.id}`);
      expect(orders.listByShop(db, s.shop.id)).toHaveLength(1);
    });

    it('makes a fresh PayPal order when a retry follows a lost PayPal response, and that order can be paid', async () => {
      // PayPal creates the order but the response never reaches us (timeout); the agent retries with the same key.
      const realCreate = fake.createOrder.bind(fake);
      let lose = true;
      fake.createOrder = async (input, requestId) => {
        const res = await realCreate(input, requestId);
        if (lose) {
          lose = false;
          throw new TypeError('fetch failed');
        }
        return res;
      };
      const first = await rejection(order({ clientRequestId: 'dana-1' }));
      expect(first).toMatchObject({ code: 'PAYPAL_UNAVAILABLE', retryable: true });
      const stored = await order({ clientRequestId: 'dana-1' });
      const [a, b] = calls('createOrder').map((c) => c.args[1]);
      expect(a).not.toBe(b);
      expect(b).toBe(`ord-${stored.id}`);
      const pp = fake.orders.get(stored.paypalOrderId)!;
      expect(pp.purchase_units[0].custom_id).toBe(stored.id);
      fake.approve(stored.paypalOrderId);
      const paid = await syncOrder(deps, stored.id, 'return_url');
      expect(paid.status).toBe('paid');
      expect(calls('captureOrder')).toHaveLength(1);
      expect(orders.listByShop(db, s.shop.id)).toHaveLength(1);
    });

    it('accepts a client_request_id with non-Latin-1 characters (PayPal-Request-Id stays a valid header)', async () => {
      const realCreate = fake.createOrder.bind(fake);
      fake.createOrder = async (input, requestId) => {
        new Headers({ 'PayPal-Request-Id': requestId }); // what the REST client does; throws on non-Latin-1
        return realCreate(input, requestId);
      };
      const a = await order({ clientRequestId: 'заказ-1 ☕ 注文' });
      const b = await order({ clientRequestId: 'заказ-1 ☕ 注文' });
      expect(b.id).toBe(a.id);
      expect(a.clientRequestId).toBe('заказ-1 ☕ 注文');
      expect(calls('createOrder')).toHaveLength(1);
      expect(calls('createOrder')[0].args[1]).toBe(`ord-${a.id}`);
    });

    it('is idempotent for concurrent retries with the same clientRequestId', async () => {
      const [a, b, c] = await Promise.all([order({ clientRequestId: 'k' }), order({ clientRequestId: 'k' }), order({ clientRequestId: 'k' })]);
      expect(new Set([a.id, b.id, c.id]).size).toBe(1);
      expect(calls('createOrder')).toHaveLength(1);
      expect(orders.listByShop(db, s.shop.id)).toHaveLength(1);
    });

    it('treats the same clientRequestId in another shop as a different order', async () => {
      const other = seedShop(db, { name: 'Other' });
      const a = await order({ clientRequestId: 'k' });
      const b = await createOrderForShop(deps, other.shop, { lines: [{ itemId: other.item['Sourdough loaf'].id, quantity: 1 }], fulfillment: 'pickup', clientRequestId: 'k' });
      expect(b.id).not.toBe(a.id);
    });

    it('refuses an 11th unpaid order for the shop', async () => {
      for (let i = 0; i < 10; i++) await order();
      const e = await rejection(order());
      expect(e.code).toBe('TOO_MANY_OPEN_ORDERS');
      expect(calls('createOrder')).toHaveLength(10);
    });

    it('maps PayPal 5xx and network failures to retryable PAYPAL_UNAVAILABLE and stores nothing', async () => {
      fake.failNext('createOrder', new PayPalApiError(503, 'SERVICE_UNAVAILABLE', null, 'dbg', 'down'));
      const e1 = await rejection(order());
      expect(e1.code).toBe('PAYPAL_UNAVAILABLE');
      expect(e1.retryable).toBe(true);
      fake.failNext('createOrder', new TypeError('fetch failed'));
      const e2 = await rejection(order());
      expect(e2.code).toBe('PAYPAL_UNAVAILABLE');
      expect(e2.retryable).toBe(true);
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      fake.failNext('createOrder', new PayPalApiError(422, 'UNPROCESSABLE_ENTITY', 'ITEM_TOTAL_MISMATCH', 'dbg-422', 'bad'));
      const e3 = await rejection(order());
      expect(e3.code).toBe('PAYPAL_UNAVAILABLE');
      expect(e3.retryable).toBe(false);
      expect(e3.message).not.toMatch(/could not be reached/i);
      expect(e3.message).toContain('ITEM_TOTAL_MISMATCH');
      const line = logged.mock.calls.map((c) => String(c[0])).join('\n');
      expect(line).toContain('422');
      expect(line).toContain('ITEM_TOTAL_MISMATCH');
      expect(line).toContain('dbg-422');
      logged.mockRestore();
      expect(orders.listByShop(db, s.shop.id)).toHaveLength(0);
    });

    it('propagates pricing errors without calling PayPal', async () => {
      const e = await rejection(order({ fulfillment: undefined }));
      expect(e.code).toBe('FULFILLMENT_REQUIRED');
      expect(fake.calls).toHaveLength(0);
    });

    it('keeps the price snapshot when the seller edits a price later', async () => {
      const o = await order();
      const almond = s.item['Almond croissant'];
      items.updateVariant(db, almond.variants[0].id, { priceCents: 999 });
      const again = orders.byId(db, o.id)!;
      expect(again.lines[0].unitCents).toBe(475);
      expect(again.totalCents).toBe(o.totalCents);
      const next = await order();
      expect(next.lines[0].unitCents).toBe(999);
    });
  });

  describe('syncOrder', () => {
    it('leaves an unapproved order waiting and records the check', async () => {
      const o = await order();
      clock += 5 * MIN;
      const after = await syncOrder(deps, o.id, 'poller');
      expect(after.status).toBe('awaiting_approval');
      expect(after.lastCheckedAt).toBe(new Date(clock).toISOString());
      expect(calls('captureOrder')).toHaveLength(0);
    });

    it('captures an approved order and records payer, ship-to and capture', async () => {
      const onPaid = vi.fn();
      deps.onPaid = onPaid;
      const o = await order();
      fake.approve(o.paypalOrderId, { name: 'Dana Buyer', email: 'dana@example.com', shipTo: { city: 'Austin', state: 'TX' } });
      const paid = await syncOrder(deps, o.id, 'return_url');
      expect(paid.status).toBe('paid');
      expect(paid.captureId).toMatch(/^CAP/);
      expect(paid.payerName).toBe('Dana Buyer');
      expect(paid.payerEmail).toBe('dana@example.com');
      expect(paid.shipTo).toMatchObject({ name: 'Dana Buyer', city: 'Austin', state: 'TX', postalCode: '78701', countryCode: 'US' });
      expect(paid.paidAt).toBe(new Date(clock).toISOString());
      expect(paid.lastCheckedAt).toBe(new Date(clock).toISOString());
      expect(calls('captureOrder').map((c) => c.args)).toEqual([[o.paypalOrderId, `cap-${o.paypalOrderId}`]]);
      expect(events.list(db, o.id).map((e) => [e.type, e.source])).toEqual([
        ['created', 'mcp'], ['paypal_approved', 'return_url'], ['capture_completed', 'return_url'],
      ]);
      expect(onPaid).toHaveBeenCalledTimes(1);
      expect((onPaid.mock.calls[0][0] as Order).status).toBe('paid');
    });

    it('captures exactly once when two callers sync an approved order at the same time', async () => {
      const onPaid = vi.fn();
      deps.onPaid = onPaid;
      const o = await order();
      fake.approve(o.paypalOrderId);
      const results = await Promise.all([syncOrder(deps, o.id, 'return_url'), syncOrder(deps, o.id, 'poller')]);
      expect(calls('captureOrder')).toHaveLength(1);
      expect(orders.byId(db, o.id)!.status).toBe('paid');
      expect(results.map((r) => r.status)).toContain('paid');
      expect(onPaid).toHaveBeenCalledTimes(1);
      expect(events.list(db, o.id).filter((e) => e.type === 'capture_completed')).toHaveLength(1);
    });

    it('ignores a webhook that arrives after the return URL already marked it paid, writing nothing', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      await syncOrder(deps, o.id, 'return_url');
      const before = fake.calls.length;
      const eventsBefore = events.list(db, o.id).length;
      const updatedBefore = orders.byId(db, o.id)!.updatedAt;
      for (const source of ['webhook', 'return_url', 'poller'] as const) {
        expect((await syncOrder(deps, o.id, source)).status).toBe('paid');
      }
      expect(fake.calls.length).toBe(before);
      expect(events.list(db, o.id)).toHaveLength(eventsBefore);
      expect(orders.byId(db, o.id)!.updatedAt).toBe(updatedBefore);
    });

    it('reconciles ORDER_ALREADY_CAPTURED by reading the order back from PayPal', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      const approvedSnapshot = await fake.getOrder(o.paypalOrderId);
      await fake.captureOrder(o.paypalOrderId, 'cap-elsewhere'); // captured by someone else; PayPal now COMPLETED
      const realGet = fake.getOrder.bind(fake);
      let first = true;
      fake.getOrder = async (id) => {
        if (first) {
          first = false;
          return structuredClone(approvedSnapshot); // stale read: still APPROVED
        }
        return realGet(id);
      };
      const before = calls('captureOrder').length;
      const after = await syncOrder(deps, o.id, 'poller');
      expect(calls('captureOrder').length).toBe(before + 1); // our capture got the 422
      expect(after.status).toBe('paid');
      expect(after.captureId).toBe(fake.orders.get(o.paypalOrderId)!.purchase_units[0].payments!.captures![0].id);
      expect(events.list(db, o.id).find((e) => e.type === 'capture_completed')?.detail).toMatchObject({ reconciled: 'ORDER_ALREADY_CAPTURED' });
    });

    it('reconciles an order PayPal already shows as COMPLETED without capturing again', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      await fake.captureOrder(o.paypalOrderId, `cap-${o.paypalOrderId}`);
      const before = calls('captureOrder').length;
      const after = await syncOrder(deps, o.id, 'webhook');
      expect(after.status).toBe('paid');
      expect(calls('captureOrder').length).toBe(before);
    });

    it('sends a declined card back to awaiting approval, then captures after the buyer re-approves', async () => {
      const o = await order();
      fake.nextCapture = 'DECLINED_422';
      fake.approve(o.paypalOrderId);
      const declined = await syncOrder(deps, o.id, 'return_url');
      expect(declined.status).toBe('awaiting_approval');
      expect(declined.captureClaimedAt).toBeNull();
      expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'capture_declined', detail: { issue: 'INSTRUMENT_DECLINED' } });
      // The poller does not retry on its own: PayPal still says APPROVED until the buyer re-approves.
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('awaiting_approval');
      expect(calls('captureOrder')).toHaveLength(1);
      // Buyer picks another funding source on the same link; the return URL captures with a fresh request id.
      const paid = await syncOrder(deps, o.id, 'return_url');
      expect(paid.status).toBe('paid');
      expect(calls('captureOrder').map((c) => c.args[1])).toEqual([`cap-${o.paypalOrderId}`, `cap-${o.paypalOrderId}-1`]);
    });

    it('moves to payment_pending when PayPal holds the capture, then paid when it clears', async () => {
      const o = await order();
      fake.nextCapture = 'PENDING';
      fake.approve(o.paypalOrderId);
      const pending = await syncOrder(deps, o.id, 'return_url');
      expect(pending.status).toBe('payment_pending');
      expect(pending.paidAt).toBeNull();
      fake.orders.get(o.paypalOrderId)!.purchase_units[0].payments!.captures![0].status = 'COMPLETED';
      const paid = await syncOrder(deps, o.id, 'webhook');
      expect(paid.status).toBe('paid');
      expect(paid.paidAt).not.toBeNull();
    });

    it('fails a pending capture that PayPal denies', async () => {
      const o = await order();
      fake.nextCapture = 'PENDING';
      fake.approve(o.paypalOrderId);
      await syncOrder(deps, o.id, 'return_url');
      fake.orders.get(o.paypalOrderId)!.purchase_units[0].payments!.captures![0].status = 'DECLINED';
      expect((await syncOrder(deps, o.id, 'webhook')).status).toBe('failed');
    });

    it('fails, after one sync, an order PayPal shows COMPLETED with a declined capture (no approve/decline loop)', async () => {
      for (const capStatus of ['DECLINED', 'FAILED']) {
        const o = await order();
        fake.approve(o.paypalOrderId);
        const pp = fake.orders.get(o.paypalOrderId)!;
        pp.status = 'COMPLETED';
        pp.purchase_units[0].payments = { captures: [{ id: `CAP-${capStatus}`, status: capStatus }] };
        const after = await syncOrder(deps, o.id, 'poller');
        expect(after.status, capStatus).toBe('failed');
        expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'capture_denied', detail: { captureStatus: capStatus } });
        clock += 6_000;
        const before = fake.calls.length;
        expect((await syncOrder(deps, o.id, 'poller')).status).toBe('failed');
        expect(fake.calls.length).toBe(before);
      }
      expect(calls('captureOrder')).toHaveLength(0);
    });

    it('fails an approved order when the capture call itself returns a declined capture', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      const realCapture = fake.captureOrder.bind(fake);
      fake.captureOrder = async (id, rid) => {
        const res = await realCapture(id, rid);
        res.purchase_units[0].payments!.captures![0].status = 'DECLINED';
        fake.orders.get(id)!.purchase_units[0].payments!.captures![0].status = 'DECLINED';
        return res;
      };
      expect((await syncOrder(deps, o.id, 'return_url')).status).toBe('failed');
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('failed');
    });

    it('treats a non-transient capture refusal as final for automatic retries: claim released, capture_failed logged, order stays approved', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (const err of [
        new PayPalApiError(403, 'NOT_AUTHORIZED', 'PERMISSION_DENIED', 'dbg-403', 'denied'),
        new PayPalApiError(422, 'UNPROCESSABLE_ENTITY', 'TRANSACTION_REFUSED', 'dbg-tr', 'refused'),
      ]) {
        const o = await order();
        fake.approve(o.paypalOrderId);
        const capturesBefore = calls('captureOrder').length;
        fake.failNext('captureOrder', err);
        const after = await syncOrder(deps, o.id, 'return_url');
        expect(after.status, err.issue!).toBe('approved');
        expect(after.captureClaimedAt).toBeNull();
        expect(events.list(db, o.id).at(-1)).toMatchObject({
          type: 'capture_failed', source: 'return_url', detail: { status: err.status, issue: err.issue, debugId: err.debugId },
        });
        expect(logged.mock.calls.map((c) => String(c[0])).join('\n')).toContain(err.debugId!);
        // The seller dashboard reads the refusal off the order itself (R3).
        expect(after.captureRefused).toBe(true);
        expect(orders.listByShop(db, s.shop.id).find((x) => x.id === o.id)!.captureRefused).toBe(true);
        // The poller and the agent's status checks do not hammer PayPal with the same refused capture.
        clock += 60_000;
        await syncOrder(deps, o.id, 'poller');
        clock += 60_000;
        await syncOrder(deps, o.id, 'mcp');
        expect(calls('captureOrder').length).toBe(capturesBefore + 1);
        // The buyer coming back (or a PayPal webhook) tries once more, with a fresh request id; this time PayPal accepts.
        expect((await syncOrder(deps, o.id, 'return_url')).status).toBe('paid');
        expect(calls('captureOrder').slice(-2).map((c) => c.args[1])).toEqual([`cap-${o.paypalOrderId}`, `cap-${o.paypalOrderId}-1`]);
      }
      logged.mockRestore();
    });

    it('fails without capturing when PayPal shows a different amount', async () => {
      const o = await order();
      fake.orders.get(o.paypalOrderId)!.purchase_units[0].amount!.value = '0.01';
      fake.approve(o.paypalOrderId);
      const after = await syncOrder(deps, o.id, 'return_url');
      expect(after.status).toBe('failed');
      expect(calls('captureOrder')).toHaveLength(0);
      expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'mismatch', detail: { paypalAmount: '0.01', expectedAmount: '26.50' } });
    });

    it('fails without capturing when PayPal shows a different custom_id', async () => {
      const o = await order();
      fake.orders.get(o.paypalOrderId)!.purchase_units[0].custom_id = 'ord_someoneelse';
      fake.approve(o.paypalOrderId);
      expect((await syncOrder(deps, o.id, 'return_url')).status).toBe('failed');
      expect(calls('captureOrder')).toHaveLength(0);
    });

    it('expires an order still unapproved after 60 minutes', async () => {
      const o = await order();
      clock += 59 * MIN;
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('awaiting_approval');
      clock += 2 * MIN;
      const after = await syncOrder(deps, o.id, 'poller');
      expect(after.status).toBe('expired');
      expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'expired', source: 'poller' });
    });

    it('still captures an order approved on PayPal before our expiry sweep saw it', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      clock += 61 * MIN;
      expect((await syncOrder(deps, o.id, 'poller')).status).toBe('paid');
    });

    it('never captures an expired order', async () => {
      const o = await order();
      clock += 61 * MIN;
      await syncOrder(deps, o.id, 'poller');
      fake.approve(o.paypalOrderId);
      const after = await syncOrder(deps, o.id, 'webhook');
      expect(after.status).toBe('expired');
      expect(calls('captureOrder')).toHaveLength(0);
    });

    it('does not let a failing onPaid hook fail the sync', async () => {
      deps.onPaid = () => Promise.reject(new Error('brief agent down'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const o = await order();
      fake.approve(o.paypalOrderId);
      expect((await syncOrder(deps, o.id, 'return_url')).status).toBe('paid');
      deps.onPaid = () => { throw new Error('sync throw'); };
      const o2 = await order();
      fake.approve(o2.paypalOrderId);
      expect((await syncOrder(deps, o2.id, 'return_url')).status).toBe('paid');
      await new Promise((r) => setTimeout(r, 0));
      warn.mockRestore();
    });

    it('reports PAYPAL_UNAVAILABLE when PayPal cannot be reached, and still records the check', async () => {
      const o = await order();
      fake.failNext('getOrder', new TypeError('fetch failed'));
      const e = await rejection(syncOrder(deps, o.id, 'mcp'));
      expect(e.code).toBe('PAYPAL_UNAVAILABLE');
      expect(e.retryable).toBe(true);
      const after = orders.byId(db, o.id)!;
      expect(after.status).toBe('awaiting_approval');
      expect(after.lastCheckedAt).toBe(new Date(clock).toISOString());
    });

    it('reports ORDER_NOT_FOUND for an unknown order', async () => {
      expect((await rejection(syncOrder(deps, 'ord_nope', 'mcp'))).code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('cancel and fulfil', () => {
    it('cancels an order the buyer backed out of on PayPal', async () => {
      const o = await order();
      const after = await cancelOrder(deps, o.id);
      expect(after.status).toBe('cancelled');
      expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'cancelled', source: 'cancel_url' });
    });

    it('does not cancel an order that is already paid', async () => {
      const o = await order();
      fake.approve(o.paypalOrderId);
      await syncOrder(deps, o.id, 'return_url');
      expect((await cancelOrder(deps, o.id)).status).toBe('paid');
    });

    it('marks a paid order fulfilled, and refuses an unpaid one', async () => {
      const o = await order();
      await expect(markFulfilled(deps, o.id, 'seller')).rejects.toBeInstanceOf(InvalidTransition);
      fake.approve(o.paypalOrderId);
      await syncOrder(deps, o.id, 'return_url');
      const done = await markFulfilled(deps, o.id, 'seller');
      expect(done.status).toBe('fulfilled');
      expect(done.fulfilledAt).toBe(new Date(clock).toISOString());
      expect((await markFulfilled(deps, o.id, 'seller')).status).toBe('fulfilled');
    });
  });

  describe('poller', () => {
    it('captures approved orders and expires stale ones, including orders older than the 3 h window', async () => {
      const a = await order();
      const b = await order();
      fake.approve(a.paypalOrderId);
      clock += 4 * 60 * MIN;
      await pollOnce(deps);
      expect(orders.byId(db, a.id)!.status).toBe('paid');
      expect(orders.byId(db, b.id)!.status).toBe('expired');
    });

    it('starts once per process and polls on its interval', async () => {
      vi.useFakeTimers();
      try {
        const a = await order();
        fake.approve(a.paypalOrderId);
        const stop = startPoller(deps, 15_000);
        startPoller(deps, 15_000);
        expect(isPollerRunning()).toBe(true);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(calls('getOrder')).toHaveLength(1);
        expect(orders.byId(db, a.id)!.status).toBe('paid');
        stop();
        expect(isPollerRunning()).toBe(false);
      } finally {
        stopPoller();
        vi.useRealTimers();
      }
    });

    it('keeps polling when one order fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const a = await order();
      const b = await order();
      fake.approve(b.paypalOrderId);
      const realGet = fake.getOrder.bind(fake);
      fake.getOrder = async (id) => {
        if (id === a.paypalOrderId) throw new TypeError('fetch failed');
        return realGet(id);
      };
      await pollOnce(deps);
      expect(orders.byId(db, a.id)!.status).toBe('awaiting_approval');
      expect(orders.byId(db, b.id)!.status).toBe('paid');
      warn.mockRestore();
    });
  });
});
