// GET /api/orders/status: status words for "Your orders", nothing personal.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { createFakePayPal } from '@/lib/paypal/fake';
import { createOrderForShop } from '@/lib/orders/service';
import { MAX_STATUS_REFS, ORDER_STATUS_RATE, parseStatusRefs } from '@/lib/orders/status-list';
import { resetRateLimits } from '@/lib/rate-limit';
import { GET } from '@/app/api/orders/status/route';
import { seedShop } from '../helpers/shop';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-order-status-'));
let ref: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = path.join(tmp, 'test.db');
  process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
  const db = getDb();
  const s = seedShop(db, { name: 'Status Bakery', payeeEmail: 'rosa@example.com' });
  const o = await createOrderForShop(
    { db, paypal: createFakePayPal(), appUrl: 'http://localhost:3000' },
    s.shop,
    { lines: [{ itemId: s.item['Almond croissant'].id, quantity: 1 }], fulfillment: 'pickup', buyerName: 'Jane Buyer' },
  );
  ref = o.id;
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => resetRateLimits());

const get = (refs: string, ip = '203.0.113.7') =>
  GET(new Request(`http://localhost/api/orders/status?refs=${encodeURIComponent(refs)}`, { headers: { 'x-forwarded-for': ip } }));

describe('GET /api/orders/status', () => {
  it('returns only ref, status and statusLabel for known refs, and omits unknown ones', async () => {
    const res = await get(`${ref},ord_doesnotexist`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { orders: Record<string, unknown>[] };
    expect(body.orders).toEqual([{ ref, status: 'awaiting_approval', statusLabel: 'Not paid yet' }]);
    expect(Object.keys(body.orders[0]).sort()).toEqual(['ref', 'status', 'statusLabel']);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('Jane');
    expect(raw).not.toContain('rosa@example.com');
  });

  it('refuses malformed, missing or too many refs', async () => {
    expect((await get('not-a-ref')).status).toBe(400);
    expect((await get(`${ref},ORD_UPPER`)).status).toBe(400);
    expect((await GET(new Request('http://localhost/api/orders/status'))).status).toBe(400);
    const many = Array.from({ length: MAX_STATUS_REFS + 1 }, (_, i) => `ord_x${i}`).join(',');
    expect((await get(many)).status).toBe(400);
    expect(parseStatusRefs(` ${ref} , ${ref} ,`)).toEqual([ref]);
  });

  it('is rate-limited per address', async () => {
    for (let i = 0; i < ORDER_STATUS_RATE.limit; i++) expect((await get(ref, '198.51.100.9')).status).toBe(200);
    expect((await get(ref, '198.51.100.9')).status).toBe(429);
    expect((await get(ref, '198.51.100.10')).status).toBe(200);
  });
});
