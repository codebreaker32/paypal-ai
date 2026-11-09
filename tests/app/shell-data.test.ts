// What the seller shell reads on the server: the shop's picture, counts and states for the sidebar and banners.
import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import { createFakePayPal } from '@/lib/paypal/fake';
import { createOrderForShop, type OrderDeps } from '@/lib/orders/service';
import { currentShellAccount, loadShellData } from '@/lib/seller/shell';
import { seedShop } from '../helpers/shop';

// An empty cookie jar: without a request scope cookies() throws, and the null would only be the shell's catch.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

describe('loadShellData', () => {
  it('reads the shop, its picture sources and the values the shell watches', async () => {
    const db = createTestDb();
    const s = seedShop(db);
    const deps: OrderDeps = { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' };
    const placed = await createOrderForShop(deps, s.shop, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });
    expect(orders.byId(db, placed.id)!.status).not.toBe('paid');

    const data = loadShellData(shops.byId(db, s.shop.id)!, db);
    expect(data.shopId).toBe(s.shop.id);
    expect(data.name).toBe(s.shop.name);
    expect(data.slug).toBe(s.shop.slug);
    expect(data.values.toPrepare).toBe(0);
    expect(data.values.status).toBe(s.shop.status);
    expect(data.values.recoveryUnsaved).toBe(false);
    expect(data.avatar.items.length).toBeGreaterThan(0);
  });

  it('sends no slug for a draft: its address is replaced at first publish', () => {
    const db = createTestDb();
    const s = seedShop(db);
    expect(loadShellData({ ...shops.byId(db, s.shop.id)!, status: 'draft' }, db).slug).toBe('');
  });

  it('flags a live shop with nowhere to be paid', () => {
    const db = createTestDb();
    const s = seedShop(db);
    const data = loadShellData({ ...shops.byId(db, s.shop.id)!, slug: 'rosa-bakes', payeeEmail: null, status: 'live' }, db);
    expect(data.values.payeeMissing).toBe(true);
  });
});

describe('loadShellData when the orders cannot be read', () => {
  it('still gives the shell its frame: a page-level failure then shows inside it', async () => {
    const db = createTestDb();
    const s = seedShop(db);
    const deps: OrderDeps = { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' };
    const placed = await createOrderForShop(deps, s.shop, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });
    db.prepare("UPDATE orders SET brief_json = '{' WHERE id = ?").run(placed.id);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const data = loadShellData(shops.byId(db, s.shop.id)!, db);
    expect(data.values).toMatchObject({ toPrepare: 0, paypalDown: false });
    expect(data.name).toBe(s.shop.name);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stamps the payload with when it was read', () => {
    const db = createTestDb();
    const before = Date.now();
    const data = loadShellData(shops.byId(db, seedShop(db).shop.id)!, db);
    expect(data.readAt).toBeGreaterThanOrEqual(before);
  });
});

describe('currentShellAccount', () => {
  it('is null for a visitor with no session, without reaching the error path', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(currentShellAccount()).resolves.toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
