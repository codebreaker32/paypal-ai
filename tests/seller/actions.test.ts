// Seller actions on paid orders: Add tracking (PayPal Agent Toolkit) and Mark picked up.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTestDb, type Db } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import * as events from '@/lib/db/repos/events';
import { createFakePayPal } from '@/lib/paypal/fake';
import { createSellerToolkit, type ShopScope, type ToolkitLike } from '@/lib/paypal/toolkit';
import type { OrderDeps } from '@/lib/orders/service';
import type { Order, OrderLine } from '@/lib/domain/types';
import { addTracking, markPickedUp, parseTrackingInput, SellerActionError, type TrackingToolkitFactory } from '@/lib/seller/actions';
import { seedShop, type SeededShop } from '../helpers/shop';

let seq = 0;
function placeOrder(db: Db, s: SeededShop, opts: { fulfillment?: 'pickup' | 'shipping'; status?: 'paid' | 'awaiting_approval' } = {}): Order {
  const it = s.item['Sourdough loaf'];
  const line: OrderLine = { itemId: it.id, variantId: it.variants[0].id, name: it.name, label: null, unitCents: 900, qty: 1, paypalProductId: it.paypalProductId };
  const fulfillment = opts.fulfillment ?? 'shipping';
  const o = orders.insert(
    db,
    {
      shopId: s.shop.id, fulfillment, buyerName: null, buyerNote: null, agentName: 'Claude', clientRequestId: null,
      itemsCents: 900, shippingCents: fulfillment === 'shipping' ? 800 : 0, totalCents: fulfillment === 'shipping' ? 1700 : 900,
      paypalOrderId: `PPT${String(++seq).padStart(14, '0')}`, approvalUrl: 'https://example.test/approve',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    [line],
  );
  if ((opts.status ?? 'paid') === 'paid') orders.casStatus(db, o.id, 'awaiting_approval', 'paid', { paidAt: new Date().toISOString(), captureId: 'CAP9' });
  return orders.byId(db, o.id)!;
}

function stubToolkit(result: unknown = { tracker_identifiers: [{ transaction_id: 'CAP9', tracking_number: '9400111899223100000000' }], errors: [] }) {
  const execute = {
    get_order: vi.fn(async ({ id }: { id: string }) =>
      JSON.stringify({ id, status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP9', status: 'COMPLETED' }] } }] }),
    ),
    create_shipment_tracking: vi.fn(async () => (typeof result === 'string' ? result : JSON.stringify(result))),
  };
  const tk: ToolkitLike = {
    getTools: () => ({
      get_order: { parameters: z.object({ id: z.string() }), execute: execute.get_order },
      create_shipment_tracking: { parameters: z.object({}).passthrough(), execute: execute.create_shipment_tracking },
    }),
  };
  const scopes: ShopScope[] = [];
  const factory: TrackingToolkitFactory = (scope) => {
    scopes.push(scope);
    return createSellerToolkit(scope, { factory: () => tk });
  };
  return { factory, execute, scopes };
}

describe('parseTrackingInput', () => {
  it('accepts a known carrier and strips spaces from the tracking number', () => {
    expect(parseTrackingInput({ carrier: 'USPS', trackingNumber: ' 9400 1118 9922 3100 0000 00 ' })).toEqual({
      ok: true,
      value: { carrier: 'USPS', trackingNumber: '9400111899223100000000', carrierName: null },
    });
  });

  it('requires a carrier name for Other', () => {
    expect(parseTrackingInput({ carrier: 'OTHER', trackingNumber: 'AB123456' })).toMatchObject({ ok: false });
    expect(parseTrackingInput({ carrier: 'OTHER', trackingNumber: 'AB123456', carrierName: ' OnTrac ' })).toEqual({
      ok: true,
      value: { carrier: 'OTHER', trackingNumber: 'AB123456', carrierName: 'OnTrac' },
    });
  });

  it('rejects unknown carriers, unknown keys and odd tracking numbers', () => {
    expect(parseTrackingInput({ carrier: 'PIGEON', trackingNumber: '123456' })).toMatchObject({ ok: false });
    expect(parseTrackingInput({ carrier: 'UPS', trackingNumber: '12' })).toMatchObject({ ok: false });
    expect(parseTrackingInput({ carrier: 'UPS', trackingNumber: '1Z<script>' })).toMatchObject({ ok: false });
    expect(parseTrackingInput({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'DELIVERED' })).toMatchObject({ ok: false });
    expect(parseTrackingInput(null)).toMatchObject({ ok: false });
  });
});

describe('addTracking', () => {
  let db: Db;
  let s: SeededShop;
  let deps: OrderDeps;

  beforeEach(() => {
    db = createTestDb();
    s = seedShop(db);
    deps = { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' };
  });

  it('sends tracking to PayPal through the toolkit, stores the tracker, fulfils the order and logs tracking_added', async () => {
    const o = placeOrder(db, s);
    const tk = stubToolkit();

    const r = await addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, { carrier: 'USPS', trackingNumber: '9400111899223100000000', carrierName: null });

    expect(tk.execute.create_shipment_tracking).toHaveBeenCalledWith({
      order_id: o.paypalOrderId,
      transaction_id: 'CAP9',
      tracking_number: '9400111899223100000000',
      carrier: 'USPS',
      status: 'SHIPPED',
    });
    expect(r.order.status).toBe('fulfilled');
    expect(r.trackers).toEqual([expect.objectContaining({ carrier: 'USPS', trackingNumber: '9400111899223100000000', paypalStatus: 'SHIPPED' })]);
    const types = events.list(db, o.id).map((e) => [e.type, e.source]);
    expect(types).toContainEqual(['fulfilled', 'seller']);
    expect(types.at(-1)).toEqual(['tracking_added', 'seller']);
    // Scoped to this shop's own PayPal ids.
    expect(tk.scopes[0].orderIds.has(o.paypalOrderId)).toBe(true);
  });

  it('maps Other to PayPal OTHER and keeps the carrier name on our tracker', async () => {
    const o = placeOrder(db, s);
    const tk = stubToolkit();
    const r = await addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, { carrier: 'OTHER', trackingNumber: 'OT12345678', carrierName: 'OnTrac' });
    expect(tk.execute.create_shipment_tracking).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'OTHER' }));
    expect(r.trackers[0].carrier).toBe('OnTrac');
  });

  it("surfaces PayPal's own error message and leaves the order paid", async () => {
    const o = placeOrder(db, s);
    const tk = stubToolkit(JSON.stringify({ ok: false, status: 422, code: 'PAYPAL_API_HTTP_ERROR', message: 'The requested action could not be performed: Invalid tracking number.' }));
    const err = await addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, { carrier: 'UPS', trackingNumber: '1Z999', carrierName: null }).catch((e) => e);
    expect(err).toBeInstanceOf(SellerActionError);
    expect(err).toMatchObject({ status: 502, code: 'PAYPAL_REJECTED' });
    expect(err.message).toContain('Invalid tracking number');
    expect(orders.byId(db, o.id)!.status).toBe('paid');
    expect(orders.trackers(db, o.id)).toEqual([]);
  });

  it('treats a 200 batch response that only has errors as a PayPal rejection', async () => {
    const o = placeOrder(db, s);
    const tk = stubToolkit({ tracker_identifiers: [], errors: [{ name: 'INVALID_REQUEST', message: 'Carrier is not supported.', details: [{ issue: 'INVALID_CARRIER', description: 'Carrier is not supported.' }] }] });
    const err = await addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, { carrier: 'DHL', trackingNumber: 'JD0123456789', carrierName: null }).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: 'PAYPAL_REJECTED' });
    expect(err.message).toContain('Carrier is not supported');
    expect(orders.byId(db, o.id)!.status).toBe('paid');
  });

  it('a toolkit that cannot be built or reached is PAYPAL_UNAVAILABLE', async () => {
    const o = placeOrder(db, s);
    const err = await addTracking(
      { ...deps, toolkit: () => ({ createShipmentTracking: async () => { throw new Error('ETIMEDOUT'); } }) },
      s.shop, o.id, { carrier: 'UPS', trackingNumber: '1Z999AA10123456784', carrierName: null },
    ).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: 'PAYPAL_UNAVAILABLE' });
  });

  it('only for paid shipping orders of this shop', async () => {
    const tk = stubToolkit();
    const input = { carrier: 'USPS' as const, trackingNumber: '9400111899223100000000', carrierName: null };
    const pickup = placeOrder(db, s, { fulfillment: 'pickup' });
    const unpaid = placeOrder(db, s, { status: 'awaiting_approval' });
    const other = seedShop(db, { name: 'Other Bakery' });
    const foreign = placeOrder(db, other);

    await expect(addTracking({ ...deps, toolkit: tk.factory }, s.shop, pickup.id, input)).rejects.toMatchObject({ status: 409, code: 'PICKUP_ORDER' });
    await expect(addTracking({ ...deps, toolkit: tk.factory }, s.shop, unpaid.id, input)).rejects.toMatchObject({ status: 409, code: 'NOT_PAID' });
    await expect(addTracking({ ...deps, toolkit: tk.factory }, s.shop, foreign.id, input)).rejects.toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
    await expect(addTracking({ ...deps, toolkit: tk.factory }, s.shop, 'ord_nope', input)).rejects.toMatchObject({ status: 404 });
    expect(tk.execute.create_shipment_tracking).not.toHaveBeenCalled();
  });

  it('an already-fulfilled order says tracking was added', async () => {
    const o = placeOrder(db, s);
    const tk = stubToolkit();
    const input = { carrier: 'USPS' as const, trackingNumber: '9400111899223100000000', carrierName: null };
    await addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, input);
    await expect(addTracking({ ...deps, toolkit: tk.factory }, s.shop, o.id, input)).rejects.toMatchObject({ status: 409, code: 'ALREADY_FULFILLED' });
    expect(tk.execute.create_shipment_tracking).toHaveBeenCalledTimes(1);
  });
});

describe('markPickedUp', () => {
  let db: Db;
  let s: SeededShop;
  let deps: OrderDeps;

  beforeEach(() => {
    db = createTestDb();
    s = seedShop(db);
    deps = { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' };
  });

  it('moves a paid pickup order to fulfilled', async () => {
    const o = placeOrder(db, s, { fulfillment: 'pickup' });
    const r = await markPickedUp(deps, s.shop, o.id);
    expect(r.status).toBe('fulfilled');
    expect(r.fulfilledAt).not.toBeNull();
    expect(events.list(db, o.id).at(-1)).toMatchObject({ type: 'fulfilled', source: 'seller' });
  });

  it('refuses shipping, unpaid, fulfilled and foreign orders', async () => {
    const ship = placeOrder(db, s);
    const unpaid = placeOrder(db, s, { fulfillment: 'pickup', status: 'awaiting_approval' });
    const done = placeOrder(db, s, { fulfillment: 'pickup' });
    await markPickedUp(deps, s.shop, done.id);
    const foreign = placeOrder(db, seedShop(db, { name: 'Elsewhere' }), { fulfillment: 'pickup' });

    await expect(markPickedUp(deps, s.shop, ship.id)).rejects.toMatchObject({ status: 409, code: 'SHIPPING_ORDER' });
    await expect(markPickedUp(deps, s.shop, unpaid.id)).rejects.toMatchObject({ status: 409, code: 'NOT_PAID' });
    await expect(markPickedUp(deps, s.shop, done.id)).rejects.toMatchObject({ status: 409, code: 'ALREADY_FULFILLED' });
    await expect(markPickedUp(deps, s.shop, foreign.id)).rejects.toMatchObject({ status: 404 });
  });
});
