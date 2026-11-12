// The rows of /shops: order, wording and where each one goes.
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { dayLabel } from '@/lib/domain/day';
import { loadShopRows, shopRowHref, shopRowStatus, sortShopRows, type ShopRowData } from '@/lib/seller/shop-rows';
import * as accounts from '@/lib/db/repos/accounts';
import type { Db } from '@/lib/db';
import { createFakePayPal } from '@/lib/paypal/fake';
import { createOrderForShop, type OrderDeps } from '@/lib/orders/service';
import { seedShop } from '../helpers/shop';

const row = (id: string, toPrepare: number, createdAt: string): Pick<ShopRowData, 'id' | 'toPrepare' | 'createdAt'> => ({ id, toPrepare, createdAt });

describe('sortShopRows', () => {
  it('puts the most to prepare first, then the newest', () => {
    const sorted = sortShopRows([
      row('old', 0, '2026-11-01T00:00:00.000Z'),
      row('new', 0, '2026-11-05T00:00:00.000Z'),
      row('two', 2, '2026-10-01T00:00:00.000Z'),
      row('three', 3, '2026-09-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['three', 'two', 'new', 'old']);
  });

  it('keeps the given order for a full tie and leaves its input alone', () => {
    const input = [row('a', 1, '2026-11-01T00:00:00.000Z'), row('b', 1, '2026-11-01T00:00:00.000Z')];
    expect(sortShopRows(input).map((r) => r.id)).toEqual(['a', 'b']);
    expect(sortShopRows(input)).not.toBe(input);
  });
});

describe('shopRowStatus', () => {
  it('reads Not published yet for a draft, whatever its email', () => {
    expect(shopRowStatus('draft', true)).toEqual({ tone: 'neutral', word: 'Not published yet' });
    expect(shopRowStatus('draft', false)).toEqual({ tone: 'neutral', word: 'Not published yet' });
  });

  it('otherwise says what the shell says', () => {
    expect(shopRowStatus('live', false)).toEqual({ tone: 'ok', word: 'Live' });
    expect(shopRowStatus('paused', false)).toEqual({ tone: 'warn', word: 'Paused' });
    expect(shopRowStatus('live', true)).toEqual({ tone: 'warn', word: 'Not taking orders' });
  });
});

describe('shopRowHref', () => {
  it('sends a draft to setup and anything else to its dashboard', () => {
    expect(shopRowHref('shp_1', 'draft')).toBe('/shops/shp_1/setup');
    expect(shopRowHref('shp_1', 'live')).toBe('/shops/shp_1');
    expect(shopRowHref('shp_1', 'paused')).toBe('/shops/shp_1');
  });
});

function account(db: Db, email: string) {
  return accounts.create(db, { email, passwordHash: 'x', recoveryHash: 'y', termsVersion: '1' });
}

describe('loadShopRows', () => {
  it('reads only this account’s shops, with counts of paid orders', async () => {
    const db = createTestDb();
    const mine = account(db, 'mine@example.com');
    const other = account(db, 'other@example.com');
    const a = shops.create(db, { name: 'First', accountId: mine.id }).shop;
    const b = shops.create(db, { name: 'Second', accountId: mine.id }).shop;
    shops.create(db, { name: 'Not mine', accountId: other.id });
    const s = seedShop(db);
    db.prepare('UPDATE shops SET account_id = ? WHERE id = ?').run(mine.id, s.shop.id);
    const deps: OrderDeps = { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' };
    await createOrderForShop(deps, shops.byId(db, s.shop.id)!, { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup' });
    db.prepare("UPDATE orders SET status = 'paid' WHERE shop_id = ?").run(s.shop.id);

    const rows = loadShopRows(mine.id, db);
    expect(rows.map((r) => r.id)).toEqual([s.shop.id, b.id, a.id]);
    expect(rows[0].toPrepare).toBe(1);
    expect(rows[1].toPrepare).toBe(0);
    expect(rows[1].status.word).toBe('Not published yet');
    expect(rows[1].href).toBe(`/shops/${b.id}/setup`);
    expect(rows[1].avatar.shop.kind).toBeDefined();
  });

  it('is empty with no shops', () => {
    const db = createTestDb();
    expect(loadShopRows(account(db, 'none@example.com').id, db)).toEqual([]);
  });
});

describe('dayLabel', () => {
  it('reads like 8 Nov 2026 in the time zone given', () => {
    expect(dayLabel('2026-11-08T12:00:00.000Z', 'UTC')).toBe('8 Nov 2026');
    expect(dayLabel('2026-11-08T23:30:00.000Z', 'Asia/Kolkata')).toBe('9 Nov 2026');
  });
});
