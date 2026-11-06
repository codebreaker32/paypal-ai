import { describe, expect, it } from 'vitest';
import type { Order, OrderEventRow } from '@/lib/domain/types';
import { agentLabel, buyerLabel, groupOrders, groupTotalCents, itemSummary, mergePolledOrders, timelineEntries, whereLabel } from '@/lib/seller/view';

const base: Order = {
  id: 'ord_1', number: 'SHF-AAAAAA', shopId: 'shp_1', status: 'paid', fulfillment: 'shipping', buyerName: 'Dana', buyerNote: null,
  agentName: 'Claude', clientRequestId: null, itemsCents: 1850, shippingCents: 800, totalCents: 2650, paypalOrderId: 'PP1',
  approvalUrl: 'https://x', expiresAt: '2026-11-06T19:00:00.000Z', captureClaimedAt: null, captureId: 'CAP1', payerName: 'Dana Buyer',
  payerEmail: 'dana@example.com', shipTo: { name: 'Dana Buyer', line1: '1 Main St', line2: null, city: 'Austin', state: 'TX', postalCode: '78701', countryCode: 'US' },
  brief: null, briefSource: null, paidAt: '2026-11-06T18:05:00.000Z', fulfilledAt: null, lastCheckedAt: null,
  createdAt: '2026-11-06T18:00:00.000Z', updatedAt: '2026-11-06T18:05:00.000Z',
  lines: [
    { itemId: 'i1', variantId: 'v1', name: 'Almond croissant', label: null, unitCents: 475, qty: 2, paypalProductId: null },
    { itemId: 'i2', variantId: 'v2', name: 'Drip coffee', label: 'L', unitCents: 400, qty: 1, paypalProductId: null },
  ],
};
const o = (over: Partial<Order>): Order => ({ ...base, ...over });

describe('seller view helpers', () => {
  it('groups orders: to prepare, waiting for payment, done', () => {
    const g = groupOrders([
      o({ id: 'a', status: 'paid' }),
      o({ id: 'b', status: 'awaiting_approval' }),
      o({ id: 'c', status: 'approved' }),
      o({ id: 'd', status: 'payment_pending' }),
      o({ id: 'e', status: 'fulfilled' }),
      o({ id: 'f', status: 'failed' }),
      o({ id: 'g', status: 'cancelled' }),
      o({ id: 'h', status: 'expired' }),
    ]);
    expect(g.toPrepare.map((x) => x.id)).toEqual(['a']);
    expect(g.waiting.map((x) => x.id)).toEqual(['b', 'c', 'd']);
    expect(g.done.map((x) => x.id)).toEqual(['e', 'f', 'g', 'h']);
  });

  it('adds up the order totals in a group, in cents, for its header', () => {
    expect(groupTotalCents([o({ totalCents: 2700 }), o({ totalCents: 1650 })])).toBe(4350);
    expect(groupTotalCents([o({ totalCents: 2700 }), o({ totalCents: 2700 }), o({ totalCents: 2900 })])).toBe(8300);
    expect(groupTotalCents([])).toBe(0);
  });

  it('summarises items with quantities and options', () => {
    expect(itemSummary(base.lines)).toBe('2 × Almond croissant, 1 × Drip coffee (L)');
  });

  it('says where the order goes', () => {
    expect(whereLabel(base)).toBe('Ship to Austin, TX');
    expect(whereLabel(o({ fulfillment: 'pickup', shipTo: null }))).toBe('Pickup');
    expect(whereLabel(o({ shipTo: null }))).toBe('Shipping');
  });

  it('names the buyer and the assistant in plain words', () => {
    expect(buyerLabel(base)).toBe('Dana Buyer');
    expect(buyerLabel(o({ payerName: null }))).toBe('Dana');
    expect(buyerLabel(o({ payerName: null, buyerName: null }))).toBe('Buyer');
    expect(agentLabel('Claude')).toBe('Claude');
    expect(agentLabel('shelfie-assistant')).toBe('Shelfie Assistant');
    expect(agentLabel('claude-code')).toBe('Claude Code');
    expect(agentLabel(null)).toBe('an AI assistant');
  });

  it('turns order events into plain-word timeline entries', () => {
    const ev = (type: string, detail: unknown = null, source: OrderEventRow['source'] = 'poller'): OrderEventRow => ({
      id: `evt_${type}`, orderId: base.id, type, source, detail, createdAt: '2026-11-06T18:00:00.000Z',
    });
    const entries = timelineEntries(
      [
        ev('created', { agentName: 'Claude' }, 'mcp'),
        ev('sync', { ignored: true }),
        ev('paypal_approved', null, 'return_url'),
        ev('capture_completed', { captureId: 'CAP1' }, 'return_url'),
        ev('capture_completed', { ignored: true }, 'webhook'),
        ev('fulfilled', null, 'seller'),
        ev('tracking_added', { carrier: 'USPS', trackingNumber: '9400111899223100000000' }, 'seller'),
        ev('something_new'),
      ],
      base,
    );
    expect(entries.map((e) => e.text)).toEqual([
      'Order created by Claude',
      'Approved on PayPal',
      'Payment received',
      'Marked shipped',
      'Tracking added: USPS 9400111899223100000000',
    ]);
    const pickup = timelineEntries([ev('fulfilled', null, 'seller')], o({ fulfillment: 'pickup' }));
    expect(pickup[0].text).toBe('Marked picked up');
  });

  it('a stale poll never moves a picked-up order back to paid', () => {
    const mine = [o({ id: 'a', status: 'fulfilled' }), o({ id: 'b', status: 'awaiting_approval' })];
    const polled = [o({ id: 'a', status: 'paid' }), o({ id: 'b', status: 'paid' }), o({ id: 'c', status: 'paid' })];
    expect(mergePolledOrders(mine, polled).map((x) => x.status)).toEqual(['fulfilled', 'paid', 'paid']);
    expect(mergePolledOrders([o({ id: 'a', status: 'paid' })], [o({ id: 'a', status: 'fulfilled' })])[0].status).toBe('fulfilled');
  });
});
