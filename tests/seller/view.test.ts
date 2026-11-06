import { describe, expect, it } from 'vitest';
import type { Order, OrderEventRow } from '@/lib/domain/types';
import { orderStatusMeta } from '@/components/dashboard/status';
import { actionWords, agentLabel, buyerLabel, cardDeclined, groupOrders, groupTotalCents, heldForUnknownEmail, itemSummary, mergePolledOrders, paypalCardWords, timelineEntries, whereLabel } from '@/lib/seller/view';

const base: Order = {
  id: 'ord_1', number: 'SHF-AAAAAA', shopId: 'shp_1', status: 'paid', fulfillment: 'shipping', buyerName: 'Dana', buyerNote: null,
  agentName: 'Claude', clientRequestId: null, itemsCents: 1850, shippingCents: 800, totalCents: 2650, paypalOrderId: 'PP1',
  approvalUrl: 'https://x', expiresAt: '2026-11-06T19:00:00.000Z', captureClaimedAt: null, captureId: 'CAP1', payerName: 'Dana Buyer',
  payerEmail: 'dana@example.com', payeeEmail: null, shipTo: { name: 'Dana Buyer', line1: '1 Main St', line2: null, city: 'Austin', state: 'TX', postalCode: '78701', countryCode: 'US' },
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
    expect(buyerLabel(o({ payerName: null, buyerName: null }))).toBe('No name given');
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

  it('says plainly when PayPal refused the capture: nothing charged, do not hand over or ship (R3)', () => {
    const ev = (type: string, detail: unknown = null): OrderEventRow => ({
      id: `evt_${type}`, orderId: base.id, type, source: 'return_url', detail, createdAt: '2026-11-06T18:00:00.000Z',
    });
    const entries = timelineEntries(
      [ev('paypal_approved'), ev('capture_failed', { status: 422, issue: 'TRANSACTION_REFUSED' }), ev('capture_refused', { paypalStatus: 'VOIDED' })],
      base,
    );
    expect(entries.slice(1)).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/PayPal refused the payment.*nothing was charged/i), tone: 'danger' }),
      expect.objectContaining({ text: expect.stringMatching(/closed/i), tone: 'danger' }),
    ]);

    const refused = o({ status: 'approved', captureRefused: true });
    expect(orderStatusMeta(refused)).toMatchObject({ label: 'PayPal refused payment', tone: 'danger' });
    expect(orderStatusMeta(o({ status: 'approved' }))).toMatchObject({ label: 'Approved, taking payment' });
    // Waiting is a normal pending state: neutral, never the warn ochre or the error vermilion.
    expect(orderStatusMeta(o({ status: 'awaiting_approval' }))).toMatchObject({ label: 'Waiting for approval', tone: 'neutral' });

    const [title, text] = actionWords(refused);
    expect(title).toBe('PayPal refused the payment');
    expect(text).toMatch(/nothing was charged/i);
    expect(text).toMatch(/don’t hand over or ship/i);
    expect(text).not.toMatch(/few seconds/);
    expect(actionWords(o({ status: 'approved' }))[1]).toMatch(/few seconds/);
  });

  describe("an order paid into the seller's own PayPal account (spec §8a)", () => {
    const ev = (type: string, detail: unknown = null, source: OrderEventRow['source'] = 'return_url'): OrderEventRow => ({
      id: `evt_${type}`, orderId: base.id, type, source, detail, createdAt: '2026-11-06T18:00:00.000Z',
    });

    it('a mistyped email: PayPal holds the payment (UNILATERAL); the words say why, name the email and point to Settings', () => {
      const held = o({ status: 'payment_pending', payeeEmail: 'rosa@exmaple.com', paidAt: null });
      const events = [ev('created', null, 'mcp'), ev('paypal_approved'), ev('capture_pending', { captureStatus: 'PENDING', pendingReason: 'UNILATERAL' })];
      expect(heldForUnknownEmail(held, events)).toBe(true);
      const [title, text] = actionWords(held, false, false, true);
      expect(title).toBe('PayPal is holding this payment');
      expect(text).toMatch(/^No PayPal account uses rosa@exmaple\.com yet\./);
      expect(text).toMatch(/Settings/);
      expect(text).toMatch(/Don’t hand over or ship/);
      expect(timelineEntries(events, held).at(-1)).toEqual(
        expect.objectContaining({ text: 'PayPal is holding this payment: no PayPal account uses rosa@exmaple.com yet', tone: 'warn' }),
      );
      // Any other pending reason keeps the general words.
      const review = [ev('capture_pending', { captureStatus: 'PENDING', pendingReason: 'PENDING_REVIEW' })];
      expect(heldForUnknownEmail(held, review)).toBe(false);
      expect(actionWords(held)[0]).toBe('Payment pending');
      expect(timelineEntries(review, held)[0].text).toBe('Payment pending at PayPal');
      // Once it clears, it is no longer held.
      expect(heldForUnknownEmail(o({ status: 'paid', payeeEmail: 'rosa@exmaple.com' }), events)).toBe(false);
    });

    it('a payee mismatch says PayPal would have paid a different account', () => {
      const entries = timelineEntries(
        [ev('mismatch', { paypalAmount: '26.50', expectedAmount: '26.50', payeeMatches: false }), ev('mismatch', { paypalAmount: '0.01', expectedAmount: '26.50' })],
        o({ payeeEmail: 'rosa@example.com', status: 'failed' }),
      );
      expect(entries.map((e) => [e.text, e.tone])).toEqual([
        ['Stopped: PayPal would have paid a different PayPal account, so nothing was charged', 'danger'],
        ['Stopped: PayPal’s amount didn’t match this order', 'danger'],
      ]);
    });

    it("the order page's PayPal card names the account the order paid, and calls it the demo's only for the demo shop", () => {
      expect(paypalCardWords(o({ payeeEmail: 'rosa@example.com' }), false)).toEqual({
        paidTo: 'rosa@example.com',
        note: 'Search these in that PayPal account to find the payment.',
      });
      expect(paypalCardWords(o({ payeeEmail: null }), true)).toEqual({
        paidTo: 'Shelfie’s demo PayPal account',
        note: 'This demo shop is paid to Shelfie’s own sandbox account, so the payment is there, not in yours.',
      });
      // A shop's order from before it had a PayPal email (paid to the platform).
      const legacy = paypalCardWords(o({ payeeEmail: null }), false);
      expect(legacy).toEqual({
        paidTo: 'Shelfie’s PayPal account',
        note: 'This order was placed before your shop had a PayPal email, so the payment is in Shelfie’s account, not yours.',
      });
      expect(JSON.stringify(legacy)).not.toMatch(/demo/);
    });

    it('tracking saved in Shelfie only reads as saved, not sent to PayPal', () => {
      const entries = timelineEntries(
        [
          ev('tracking_added', { carrier: 'USPS', trackingNumber: '9400111899223100000000', atPayPal: false }, 'seller'),
          ev('tracking_added', { carrier: 'UPS', trackingNumber: '1Z999AA10123456784', atPayPal: true }, 'seller'),
        ],
        base,
      );
      expect(entries.map((e) => e.text)).toEqual(['Tracking saved: USPS 9400111899223100000000', 'Tracking added: UPS 1Z999AA10123456784']);
    });
  });

  it('says the card was declined, not that the buyer hasn’t approved, after PayPal declines their card', () => {
    const ev = (type: string, detail: unknown = null): OrderEventRow => ({
      id: `evt_${type}`, orderId: base.id, type, source: 'return_url', detail, createdAt: '2026-11-06T18:00:00.000Z',
    });
    const waiting = o({ status: 'awaiting_approval' });
    const declined = [ev('created'), ev('paypal_approved'), ev('capture_declined', { issue: 'INSTRUMENT_DECLINED' })];
    expect(cardDeclined(waiting, declined)).toBe(true);
    expect(cardDeclined(waiting, [ev('created'), ev('capture_declined', { ignored: true })])).toBe(false);
    expect(cardDeclined(o({ status: 'paid' }), declined)).toBe(false);
    expect(actionWords(waiting, true)).toEqual([
      'Card declined',
      'PayPal declined the buyer’s card. They can pick another on PayPal. Nothing to prepare until it shows Paid.',
    ]);
    expect(actionWords(waiting)[0]).toBe('Waiting for the buyer');
  });

  it('a stale poll never moves a picked-up order back to paid', () => {
    const mine = [o({ id: 'a', status: 'fulfilled' }), o({ id: 'b', status: 'awaiting_approval' })];
    const polled = [o({ id: 'a', status: 'paid' }), o({ id: 'b', status: 'paid' }), o({ id: 'c', status: 'paid' })];
    expect(mergePolledOrders(mine, polled).map((x) => x.status)).toEqual(['fulfilled', 'paid', 'paid']);
    expect(mergePolledOrders([o({ id: 'a', status: 'paid' })], [o({ id: 'a', status: 'fulfilled' })])[0].status).toBe('fulfilled');
  });
});

describe('an order the shop cancelled before payment (npm run seed -- --cancel-unpaid)', () => {
  const cancel = (source: OrderEventRow['source']): OrderEventRow => ({
    id: `evt_${source}`, orderId: 'ord_1', type: 'cancelled', source, detail: null, createdAt: '2026-11-06T18:00:00.000Z',
  });

  it('says the shop cancelled it, not the buyer', () => {
    const [title, text] = actionWords(o({ status: 'cancelled' }), false, true);
    expect(title).toBe('Cancelled');
    expect(text).toMatch(/shop cancelled/i);
    expect(text).toMatch(/nothing was charged/i);
    expect(actionWords(o({ status: 'cancelled' }))[1]).toMatch(/buyer cancelled on PayPal/);

    expect(timelineEntries([cancel('seller')], o({}))[0].text).toBe('Cancelled by the shop before payment');
    expect(timelineEntries([cancel('cancel_url')], o({}))[0].text).toBe('Cancelled on PayPal by the buyer');
    expect(timelineEntries([{ ...cancel('poller'), detail: { paypalStatus: 'VOIDED' } }], o({}))[0].text).toBe('PayPal voided the order before payment');
  });
});
