// The receipt's "Paid to" line (spec §4 Receipt, §8a): the seller's own PayPal account, masked, or Shelfie's demo account.
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { createFakePayPal, type FakePayPal } from '@/lib/paypal/fake';
import { receiptView } from '@/lib/orders/receipt';
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
    expect(JSON.stringify(view)).not.toContain('rosa@example.com');
    // A later change to the shop's email doesn't rewrite where this order was paid.
    shops.update(db, s.shop.id, { payeeEmail: 'other@example.com' });
    expect(receiptView(db, o.id)!.paidTo).toEqual({ kind: 'seller', shopName: 'Rosa Bakes', maskedEmail: 'r•••@example.com' });
  });

  it('a payment PayPal holds (pending) already says where it goes', async () => {
    const s = seedShop(db, { name: 'Rosa Bakes', payeeEmail: 'rosa@exmaple.com' });
    const o = await place(s);
    fake.nextCapture = 'PENDING_UNILATERAL';
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    expect(receiptView(db, o.id)).toMatchObject({ status: 'payment_pending', paidTo: { kind: 'seller', maskedEmail: 'r•••@exmaple.com' } });
  });

  it("the demo shop's order is paid to Shelfie's demo account", async () => {
    const s = seedShop(db);
    const o = await place(s);
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    expect(receiptView(db, o.id)!.paidTo).toEqual({ kind: 'platform', shopName: 'Marigold Bakehouse' });
  });

  it('no paidTo for an order that was never paid', async () => {
    const s = seedShop(db, { name: 'Rosa Bakes' });
    const o = await place(s);
    fake.orders.get(o.paypalOrderId)!.purchase_units[0].amount!.value = '0.01';
    fake.approve(o.paypalOrderId);
    await syncOrder(deps, o.id, 'return_url');
    expect(receiptView(db, o.id)).toMatchObject({ status: 'failed', paidTo: null });
  });
});
