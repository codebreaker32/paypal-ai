// "Can't reach PayPal" banner when the poller's PayPal reads fail fast (sync still stamps lastCheckedAt).
import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import { createFakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError } from '@/lib/paypal/types';
import { createOrderForShop, syncOrder, type OrderDeps } from '@/lib/orders/service';
import { pollOnce } from '@/lib/orders/poller';
import { paypalLooksUnreachable } from '@/lib/seller/health';
import { seedShop } from '../helpers/shop';

describe('paypalLooksUnreachable when PayPal reads fail', () => {
  it('shows the banner while every poller read fails, and clears it once PayPal answers again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = createTestDb();
    const fake = createFakePayPal();
    const s = seedShop(db);
    let clock = Date.now();
    const deps: OrderDeps = { db, paypal: fake, appUrl: 'http://localhost:3000', now: () => clock };
    const o = await createOrderForShop(deps, s.shop, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });
    fake.approve(o.paypalOrderId);

    const failures = [new TypeError('fetch failed'), new PayPalApiError(503, 'SERVICE_UNAVAILABLE', 'down', 'dbg', 'down')];
    for (let pass = 0; pass < 12; pass++) {
      clock += 15_000;
      fake.failNext('getOrder', failures[pass % 2]);
      await pollOnce(deps);
    }
    const stuck = orders.byId(db, o.id)!;
    expect(stuck.status).toBe('awaiting_approval');
    expect(paypalLooksUnreachable(db, [stuck], clock)).toBe(true);

    clock += 15_000;
    await pollOnce(deps);
    const paid = orders.byId(db, o.id)!;
    expect(paid.status).toBe('paid');
    expect(paypalLooksUnreachable(db, [paid], clock)).toBe(false);

    // PayPal answering again clears the banner for orders that are still open too.
    const open = await createOrderForShop(deps, s.shop, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });
    clock += 15_000;
    fake.failNext('getOrder', new TypeError('fetch failed'));
    await pollOnce(deps);
    expect(paypalLooksUnreachable(db, [orders.byId(db, open.id)!], clock)).toBe(true);
    clock += 15_000;
    await pollOnce(deps);
    expect(paypalLooksUnreachable(db, [orders.byId(db, open.id)!], clock)).toBe(false);
    warn.mockRestore();
  });

  it('keeps the banner off when PayPal refuses one order read with a 4xx (PayPal answered)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = createTestDb();
    const fake = createFakePayPal();
    const a = seedShop(db, { name: 'Shop A' });
    const b = seedShop(db, { name: 'Shop B' });
    let clock = Date.now() + 60 * 60_000;
    const deps: OrderDeps = { db, paypal: fake, appUrl: 'http://localhost:3000', now: () => clock };
    const line = (s: typeof a) => ({ lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' as const });
    const fine = await createOrderForShop(deps, a.shop, line(a));
    const refused = await createOrderForShop(deps, b.shop, line(b));
    await syncOrder(deps, fine.id, 'poller');

    clock += 1_000;
    fake.failNext('getOrder', new PayPalApiError(422, 'UNPROCESSABLE_ENTITY', 'ORDER_NOT_APPROVED', 'dbg', 'refused'));
    await expect(syncOrder(deps, refused.id, 'poller')).rejects.toMatchObject({ code: 'PAYPAL_UNAVAILABLE' });

    expect(paypalLooksUnreachable(db, [orders.byId(db, fine.id)!], clock)).toBe(false);
    error.mockRestore();
  });
});
