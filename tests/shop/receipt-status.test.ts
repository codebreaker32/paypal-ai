// What the receipt says for each order state (spec §4: confirming, paid, pending, declined, cancelled, expired; plus
// an approved order whose capture PayPal refused), and when it keeps re-reading the order.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Receipt } from '@/app/o/[ref]/Receipt';
import { keepsPolling, statusView } from '@/app/o/[ref]/receipt-status';
import type { ReceiptOrder } from '@/lib/orders/receipt-types';
import type { OrderStatus } from '@/lib/domain/types';

const base: ReceiptOrder = {
  number: 'SHF-K7F2QX',
  status: 'awaiting_approval',
  totalCents: 2700,
  itemsCents: 1900,
  shippingCents: 800,
  shopName: 'Marigold Bakehouse',
  shopSlug: 'marigold-bakehouse',
  fulfillment: 'shipping',
  approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
  paidAt: null,
  declined: false,
  captureRefused: false,
  cancelledByShop: false,
  paidTo: null,
  lines: [{ name: 'Almond croissant', label: null, qty: 2, unitCents: 500 }],
};
const order = (patch: Partial<ReceiptOrder>): ReceiptOrder => ({ ...base, ...patch });
const PICKUP = 'Sat & Sun pickup · 14 Alder St';

describe('statusView', () => {
  it('waiting for approval: the PayPal button with the total', () => {
    const v = statusView(order({}), PICKUP, null);
    expect(v).toMatchObject({ tone: 'warn', title: 'Waiting for your approval', approve: 'Approve $27.00 on PayPal' });
    expect(v.body).toMatch(/Nothing is charged until you do/);
  });

  it('declined: Try PayPal again', () => {
    const v = statusView(order({ declined: true }), PICKUP, null);
    expect(v).toMatchObject({ tone: 'danger', title: 'PayPal declined that payment', approve: 'Try PayPal again' });
  });

  it('approved: confirming with PayPal', () => {
    const v = statusView(order({ status: 'approved', approvalUrl: null }), PICKUP, null);
    expect(v).toMatchObject({ tone: 'info', title: 'Confirming with PayPal…', spin: true });
    expect(v.approve).toBeUndefined();
  });

  it('approved but PayPal refused the capture: says nothing was charged, no PayPal button', () => {
    const v = statusView(order({ status: 'approved', approvalUrl: null, captureRefused: true }), PICKUP, null);
    expect(v).toMatchObject({ tone: 'danger', title: "PayPal didn’t complete the payment" });
    expect(v.body).toMatch(/nothing was charged/i);
    expect(v.body).toContain('Marigold Bakehouse');
    expect(v.approve).toBeUndefined();
    expect(v.spin).toBeFalsy();
  });

  it('pending: PayPal is still clearing it', () => {
    const v = statusView(order({ status: 'payment_pending', approvalUrl: null }), PICKUP, null);
    expect(v).toMatchObject({ tone: 'info', title: 'Confirming with PayPal…' });
    expect(v.body).toMatch(/still clearing/);
  });

  it('paid: shipping goes to the address given to PayPal (guest card or wallet); pickup shows the pickup notes', () => {
    const shipped = statusView(order({ status: 'paid', approvalUrl: null }), PICKUP, null);
    expect(shipped).toMatchObject({ tone: 'ok', title: 'Paid. Marigold Bakehouse has your order.' });
    expect(shipped.body).toBe('Marigold Bakehouse will ship it to the address you gave PayPal.');
    const pickup = statusView(order({ status: 'paid', approvalUrl: null, fulfillment: 'pickup' }), PICKUP, null);
    expect(pickup.body).toBe(`Pick it up: ${PICKUP}`);
    const noNotes = statusView(order({ status: 'paid', approvalUrl: null, fulfillment: 'pickup' }), '', null);
    expect(noNotes.body).toMatch(/will let you know when it’s ready/);
  });

  it('fulfilled: shipped with the tracking number, or picked up', () => {
    const shipped = statusView(order({ status: 'fulfilled', approvalUrl: null }), PICKUP, { carrier: 'USPS', number: '9400111899223197428490' });
    expect(shipped.body).toBe('Shipped with USPS, tracking number 9400111899223197428490.');
    expect(statusView(order({ status: 'fulfilled', approvalUrl: null, fulfillment: 'pickup' }), PICKUP, null).body).toMatch(/Picked up/);
  });

  it('cancelled, expired and failed say nothing was charged', () => {
    for (const [status, title] of [
      ['cancelled', 'Order cancelled'],
      ['expired', 'This order expired'],
      ['failed', "The payment didn’t go through"],
    ] as const) {
      const v = statusView(order({ status, approvalUrl: null }), PICKUP, null);
      expect(v.title).toBe(title);
      expect(v.body).toMatch(/nothing was charged/i);
      expect(v.approve).toBeUndefined();
    }
  });
});

describe('an order the shop cancelled', () => {
  it('tells the buyer the shop cancelled it, and nothing was charged', () => {
    const v = statusView(order({ status: 'cancelled', approvalUrl: null, cancelledByShop: true }), PICKUP, null);
    expect(v.title).toBe('Order cancelled');
    expect(v.body).toMatch(/cancelled by the shop/i);
    expect(v.body).toMatch(/nothing was charged/i);
    expect(statusView(order({ status: 'cancelled', approvalUrl: null }), PICKUP, null).body).toMatch(/^You cancelled on PayPal/);
  });
});

describe('keepsPolling', () => {
  it('re-reads only while PayPal is still deciding', () => {
    const open: OrderStatus[] = ['awaiting_approval', 'approved', 'payment_pending'];
    const closed: OrderStatus[] = ['paid', 'fulfilled', 'cancelled', 'expired', 'failed'];
    for (const status of open) expect(keepsPolling(order({ status })), status).toBe(true);
    for (const status of closed) expect(keepsPolling(order({ status })), status).toBe(false);
  });

  it('stops once PayPal refused the capture (only the buyer coming back or a webhook retries it)', () => {
    expect(keepsPolling(order({ status: 'approved', captureRefused: true }))).toBe(false);
  });
});

describe('Receipt slip', () => {
  it('says shipping goes to the address the buyer gave PayPal, not to a PayPal account a guest buyer doesn’t have', () => {
    const html = renderToStaticMarkup(
      createElement(Receipt, { orderRef: 'ord_1', initial: order({ status: 'paid', approvalUrl: null }), pickupNotes: PICKUP, fromAssistant: false, tracking: null }),
    );
    expect(html).toContain('Shipping to the address you gave PayPal.');
    expect(html).not.toContain('PayPal account');
  });

  it("says who was paid: the shop's own PayPal account (masked) or Shelfie's demo account", () => {
    const render = (paidTo: ReceiptOrder['paidTo']) =>
      renderToStaticMarkup(
        createElement(Receipt, { orderRef: 'ord_1', initial: order({ status: 'paid', approvalUrl: null, paidTo }), pickupNotes: PICKUP, fromAssistant: false, tracking: null }),
      );
    expect(render({ kind: 'seller', shopName: 'Marigold Bakehouse', maskedEmail: 'r•••@example.com' })).toContain(
      'Paid to Marigold Bakehouse’s own PayPal account (r•••@example.com)',
    );
    expect(render({ kind: 'platform', shopName: 'Marigold Bakehouse', demo: true })).toContain('Paid to Shelfie’s demo PayPal account for Marigold Bakehouse');
    // A shop's order from before it had a PayPal email (paid to the platform): not called the demo.
    const legacy = render({ kind: 'platform', shopName: 'Rosa Bakes', demo: false });
    expect(legacy).toContain('Paid to Shelfie’s PayPal account for Rosa Bakes');
    expect(legacy).not.toContain('demo');
    expect(render(null)).not.toContain('Paid to');
  });
});
