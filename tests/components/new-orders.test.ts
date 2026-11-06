import { describe, expect, it } from 'vitest';
import type { Order } from '@/lib/domain/types';
import { newlyPaid } from '@/components/dashboard/new-orders';

const base: Order = {
  id: 'ord_1', number: 'SHF-AAAAAA', shopId: 'shp_1', status: 'awaiting_approval', fulfillment: 'pickup', buyerName: 'Dana', buyerNote: null,
  agentName: 'Claude', clientRequestId: null, itemsCents: 2700, shippingCents: 0, totalCents: 2700, paypalOrderId: 'PP1',
  approvalUrl: 'https://x', expiresAt: '2026-11-06T19:00:00.000Z', captureClaimedAt: null, captureId: null, payerName: null,
  payerEmail: null, payeeEmail: null, shipTo: null, brief: null, briefSource: null, paidAt: null, fulfilledAt: null, lastCheckedAt: null,
  createdAt: '2026-11-06T18:00:00.000Z', updatedAt: '2026-11-06T18:00:00.000Z',
  lines: [{ itemId: 'i1', variantId: 'v1', name: 'Almond croissant', label: null, unitCents: 1350, qty: 2, paypalProductId: null }],
};
const o = (over: Partial<Order>): Order => ({ ...base, ...over });
const ids = (list: Order[]) => list.map((x) => x.id);

describe('newlyPaid', () => {
  it('finds an order that was waiting and is now paid', () => {
    const prev = [o({ id: 'a', status: 'awaiting_approval' }), o({ id: 'b', status: 'approved' })];
    const next = [o({ id: 'a', status: 'paid' }), o({ id: 'b', status: 'approved' })];
    expect(ids(newlyPaid(prev, next))).toEqual(['a']);
  });

  it('finds a paid order that was not there before', () => {
    expect(ids(newlyPaid([o({ id: 'a', status: 'paid' })], [o({ id: 'a', status: 'paid' }), o({ id: 'n', status: 'paid' })]))).toEqual(['n']);
  });

  it('never returns an order that was already paid, so the first poll after load (prev = the initial orders) is quiet', () => {
    const initial = [o({ id: 'a', status: 'paid' }), o({ id: 'b', status: 'fulfilled' }), o({ id: 'c', status: 'awaiting_approval' })];
    expect(newlyPaid(initial, initial)).toEqual([]);
    expect(newlyPaid(initial, initial.map((x) => ({ ...x })))).toEqual([]);
  });

  it('counts payment_pending, approved and a capture refused as unpaid', () => {
    const prev = [o({ id: 'p', status: 'payment_pending' }), o({ id: 'r', status: 'approved', captureRefused: true } as Partial<Order>)];
    const next = [o({ id: 'p', status: 'paid' }), o({ id: 'r', status: 'paid' })];
    expect(ids(newlyPaid(prev, next))).toEqual(['p', 'r']);
  });

  it('ignores orders that moved on without being paid now: fulfilled, failed, cancelled, still waiting', () => {
    const prev = [o({ id: 'a', status: 'paid' }), o({ id: 'b', status: 'awaiting_approval' }), o({ id: 'c', status: 'approved' })];
    const next = [o({ id: 'a', status: 'fulfilled' }), o({ id: 'b', status: 'cancelled' }), o({ id: 'c', status: 'failed' }), o({ id: 'd', status: 'awaiting_approval' })];
    expect(newlyPaid(prev, next)).toEqual([]);
  });

  it('does not count a fulfilled order going back to paid (a stale poll) as new', () => {
    expect(newlyPaid([o({ id: 'a', status: 'fulfilled' })], [o({ id: 'a', status: 'paid' })])).toEqual([]);
  });

  it('keeps the order of next', () => {
    const prev = [o({ id: 'a' }), o({ id: 'b' })];
    const next = [o({ id: 'b', status: 'paid' }), o({ id: 'a', status: 'paid' })];
    expect(ids(newlyPaid(prev, next))).toEqual(['b', 'a']);
  });
});
