// The receipt's "Paid to" line: the seller's own PayPal account, masked, or Shelfie's demo account.
// While PayPal still holds the payment it says where the money is going instead, never "Paid to".
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { createFakePayPal, type FakePayPal } from '@/lib/paypal/fake';
import * as ordersRepo from '@/lib/db/repos/orders';
import { goingToText, paidToText, receiptView } from '@/lib/orders/receipt';
import { createOrderForShop, syncOrder, type OrderDeps } from '@/lib/orders/service';
import { seedShop, type SeededShop } from '../helpers/shop';

describe('receiptView paidTo', () => {
  let db: Db;
  let fake: FakePayPal;
  let deps: OrderDeps;
  beforeEach(() => {
    db = createTestDb();
    fake = createFakePayPal();
    deps = { db, paypal: fake, appUrl: 'http://localhost:3000' };
  });
  const place = (s: SeededShop) =>
    createOrderForShop(deps, s.shop, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });

  it("a seller's order: null until paid, then their own account with the email masked (never the full email)", async () => {
    const s = seedShop(db, { name: 'Rosa Bakes', payeeEmail: 'rosa@example.com' });
    const o = await place(s);
    expect(receiptView(db, o.id)!.paidTo).toBeNull();
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    const view = receiptView(db, o.id)!;
    expect(view.paidTo).toEqual({ kind: 'seller', shopName: 'Rosa Bakes', maskedEmail: 'r•••@example.com' });
    expect(view.goingTo).toBeNull();
    expect(JSON.stringify(view)).not.toContain('rosa@example.com');
    // A later change to the shop's email doesn't rewrite where this order was paid.
    shops.update(db, s.shop.id, { payeeEmail: 'other@example.com' });
    expect(receiptView(db, o.id)!.paidTo).toEqual({ kind: 'seller', shopName: 'Rosa Bakes', maskedEmail: 'r•••@example.com' });
  });

  it('a payment PayPal holds (pending) says where it is going, and not that it was paid', async () => {
    const s = seedShop(db, { name: 'Rosa Bakes', payeeEmail: 'rosa@exmaple.com' });
    const o = await place(s);
    fake.nextCapture = 'PENDING_UNILATERAL';
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    const view = receiptView(db, o.id)!;
    expect(view).toMatchObject({ status: 'payment_pending', paidTo: null });
    expect(view.goingTo).toEqual({ kind: 'seller', shopName: 'Rosa Bakes', maskedEmail: 'r•••@exmaple.com' });
    expect(goingToText(view.goingTo!)).toBe('Going to Rosa Bakes’s own PayPal account (r•••@exmaple.com).');
  });

  it("a held payment for the demo shop is going to Shelfie's demo account", () => {
    expect(goingToText({ kind: 'platform', shopName: 'Marigold Bakehouse', demo: true })).toBe(
      'Going to Shelfie’s PayPal account for Marigold Bakehouse.',
    );
  });

  it("the demo shop's order is paid to Shelfie's demo account", async () => {
    const s = seedShop(db);
    const o = await place(s);
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    const paidTo = receiptView(db, o.id)!.paidTo!;
    expect(paidTo).toEqual({ kind: 'platform', shopName: 'Marigold Bakehouse', demo: true });
    expect(paidToText(paidTo)).toBe('Paid to Shelfie’s PayPal account for Marigold Bakehouse');
  });

  it("an order a shop took before it had a PayPal email (paid to the platform) is Shelfie's account, not the demo's", async () => {
    // A non-demo shop's order with no payee: created platform-paid before shops had PayPal emails.
    const s = seedShop(db, { name: 'Rosa Bakes', payeeEmail: null });
    const croissant = s.item['Almond croissant'];
    const o = ordersRepo.insert(
      db,
      {
        shopId: s.shop.id, fulfillment: 'pickup', buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
        itemsCents: 475, shippingCents: 0, totalCents: 475, paypalOrderId: 'PP-LEGACY-1', approvalUrl: 'https://x',
        expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      },
      [{ itemId: croissant.id, variantId: croissant.variants[0].id, name: croissant.name, label: null, unitCents: 475, qty: 1, paypalProductId: croissant.paypalProductId }],
    );
    ordersRepo.casStatus(db, o.id, 'awaiting_approval', 'paid', { paidAt: new Date().toISOString(), captureId: 'CAP-LEGACY' });
    const paidTo = receiptView(db, o.id)!.paidTo!;
    expect(paidTo).toEqual({ kind: 'platform', shopName: 'Rosa Bakes', demo: false });
    expect(paidToText(paidTo)).toBe('Paid to Shelfie’s PayPal account for Rosa Bakes');
    expect(paidToText(paidTo)).not.toMatch(/demo/);
  });

  it('no paidTo for an order that was never paid', async () => {
    const s = seedShop(db, { name: 'Rosa Bakes' });
    const o = await place(s);
    fake.orders.get(o.paypalOrderId)!.purchase_units[0].amount!.value = '0.01';
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    expect(receiptView(db, o.id)).toMatchObject({ status: 'failed', paidTo: null, goingTo: null });
  });
});
