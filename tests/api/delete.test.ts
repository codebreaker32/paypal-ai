// Deleting shops and accounts, changing passwords and ending sessions (SR19, with SR7, SR8 and SR11 on the password checks).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import type { DraftItem } from '@/lib/domain/types';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  guests: false,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));
vi.mock('@/lib/auth/guest', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/guest')>()),
  guestShopsAllowed: () => state.guests,
}));
vi.mock('@/lib/auth/password', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/password')>();
  return {
    ...real,
    hashPassword: vi.fn(async (p: string) => `fake$${p}`),
    verifyPassword: vi.fn(async (p: string, stored: string) => stored === `fake$${p}`),
  };
});

const { createTestDb, now } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const items = await import('@/lib/db/repos/items');
const orders = await import('@/lib/db/repos/orders');
const sessions = await import('@/lib/db/repos/sessions');
const shops = await import('@/lib/db/repos/shops');
const { publishShop } = await import('@/lib/catalog/publish');
const { createFakePayPal } = await import('@/lib/paypal/fake');
const { resetRateLimits } = await import('@/lib/rate-limit');
const password = await import('@/lib/auth/password');
const { ownerCookieName } = await import('@/lib/auth/owner');
const { sessionCookieName, startSession } = await import('@/lib/auth/session');
const { hashToken } = await import('@/lib/domain/ids');
const { DELETE: deleteShop } = await import('@/app/api/shops/[id]/route');

const draft = (name: string): DraftItem => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 300 }],
});

const PASSWORD = 'a short sentence only rosa says';
const NEW_PASSWORD = 'a different sentence for the shop';
const NAME = 'Tia Lupe Tacos';
const SLUG = 'tia-lupe-tacos';
const hashes = { verify: vi.mocked(password.verifyPassword), hash: vi.mocked(password.hashPassword) };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; message: string } }).error;
const shopRows = () => (state.db.prepare('select count(*) as n from shops').get() as { n: number }).n;
const retired = (slug: string) => state.db.prepare('select 1 from retired_slugs where slug = ?').get(slug) !== undefined;

const newAccount = (email = 'rosa@example.com') =>
  accounts.create(state.db, { email, passwordHash: `fake$${PASSWORD}`, recoveryHash: 'r', termsVersion: 'v1' });
const liveShop = (name: string, accountId: string | null) => {
  const { shop, ownerToken } = shops.create(state.db, { name, accountId, payeeEmail: 'rosa@example.com' });
  return { shop: shops.publish(state.db, shop.id), ownerToken };
};
const del = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

let orderSeq = 0;
function placeOrder(shopId: string, status: string, expiresInMs = 3_600_000): string {
  const o = orders.insert(
    state.db,
    {
      shopId, fulfillment: 'pickup', buyerName: null, buyerNote: null, agentName: 'Claude', clientRequestId: null,
      itemsCents: 900, shippingCents: 0, totalCents: 900, paypalOrderId: `PPD${String(++orderSeq).padStart(8, '0')}`,
      approvalUrl: 'https://example.test/approve', expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
    [],
  );
  state.db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, o.id);
  return o.id;
}

let uploads: string;

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(uploads, { recursive: true, force: true });
});

beforeEach(() => {
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-delete-'));
  vi.stubEnv('UPLOADS_DIR', uploads);
  hashes.verify.mockClear();
  hashes.hash.mockClear();
  state.db = createTestDb();
  state.jar.clear();
  state.guests = false;
  resetRateLimits();
});

describe('retired slugs', () => {
  const retire = (slug: string) => state.db.prepare('INSERT INTO retired_slugs (slug, retired_at) VALUES (?, ?)').run(slug, now());
  const asDraft = (id: string) => state.db.prepare('UPDATE shops SET slug = ? WHERE id = ?').run('draft-abcdefgh', id);

  it('are taken when a shop is created', () => {
    retire('tia-lupe-tacos');
    expect(shops.create(state.db, { name: 'Tia Lupe Tacos' }).shop.slug).toBe('tia-lupe-tacos-2');
  });

  it('are skipped when a numbered slug is retired too', () => {
    retire('tia-lupe-tacos');
    retire('tia-lupe-tacos-2');
    expect(shops.create(state.db, { name: 'Tia Lupe Tacos' }).shop.slug).toBe('tia-lupe-tacos-3');
  });

  it('are taken when a draft gets its public slug', () => {
    retire('tia-lupe-tacos');
    const { shop } = shops.create(state.db, { name: 'Tia Lupe Tacos' });
    asDraft(shop.id);
    expect(shops.setSlug(state.db, shop.id, 'Tia Lupe Tacos').slug).toBe('tia-lupe-tacos-2');
  });

  it('are taken by the reserved name at first publish', async () => {
    retire('marigold-bakehouse-2');
    const { shop } = shops.create(state.db, { name: 'Marigold Bakehouse', payeeEmail: 'rosa@example.com' });
    asDraft(shop.id);
    items.replaceDrafts(state.db, shop.id, [draft('Bun')]);
    await publishShop({ db: state.db, paypal: createFakePayPal() }, shop.id);
    expect(shops.byId(state.db, shop.id)!.slug).toBe('marigold-bakehouse-3');
  });
});

describe('DELETE /api/shops/[id]', () => {
  let account: ReturnType<typeof newAccount>;
  let shopId: string;
  const remove = (body: unknown = { confirmName: NAME, currentPassword: PASSWORD }, headers?: Record<string, string>) =>
    deleteShop(del(`/api/shops/${shopId}`, body, headers), ctx(shopId));

  beforeEach(async () => {
    account = newAccount();
    shopId = liveShop(NAME, account.id).shop.id;
    await startSession(account.id);
  });

  it('removes the shop, its rows and its files, and retires the slug', async () => {
    const photo = 'img_abcdefghijklmnopqrst.webp';
    const cover = 'img_bbbbbbbbbbbbbbbbbbbb.webp';
    const logo = 'img_cccccccccccccccccccc.webp';
    fs.mkdirSync(path.join(uploads, 'items'), { recursive: true });
    for (const f of [photo, cover, logo]) fs.writeFileSync(path.join(uploads, 'items', f), 'x');
    fs.mkdirSync(path.join(uploads, shopId));
    fs.writeFileSync(path.join(uploads, shopId, 'page-1.jpg'), 'x');
    const [item] = items.replaceDrafts(state.db, shopId, [draft('Bun')]);
    items.update(state.db, item.id, { photoUrl: `/i/${photo}` });
    shops.update(state.db, shopId, { coverUrl: `/i/${cover}`, logoUrl: `/i/${logo}` });
    placeOrder(shopId, 'fulfilled');

    const res = await remove();

    expect(res.status).toBe(204);
    expect(shops.byId(state.db, shopId)).toBeNull();
    expect(state.db.prepare('select count(*) as n from items').get()).toEqual({ n: 0 });
    expect(state.db.prepare('select count(*) as n from orders').get()).toEqual({ n: 0 });
    expect(retired(SLUG)).toBe(true);
    expect(fs.readdirSync(path.join(uploads, 'items'))).toEqual([]);
    expect(fs.existsSync(path.join(uploads, shopId))).toBe(false);
    expect(accounts.byId(state.db, account.id)).not.toBeNull();
  });

  it('gives the same name a new slug afterwards', async () => {
    await remove();
    expect(shops.create(state.db, { name: NAME }).shop.slug).toBe(`${SLUG}-2`);
  });

  it('never touches a bundled photo', async () => {
    fs.mkdirSync(path.join(uploads, 'items'), { recursive: true });
    fs.writeFileSync(path.join(uploads, 'items', 'keep.webp'), 'x');
    shops.update(state.db, shopId, { coverUrl: '/demo/x/keep.webp' });
    expect((await remove()).status).toBe(204);
    expect(fs.existsSync(path.join(uploads, 'items', 'keep.webp'))).toBe(true);
  });

  it('refuses a cross-site request before anything else', async () => {
    const res = await remove(undefined, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('BAD_ORIGIN');
    expect(shopRows()).toBe(1);
  });

  it('is 404 for a browser that does not own the shop', async () => {
    state.jar.clear();
    await startSession(newAccount('other@example.com').id);
    expect((await remove()).status).toBe(404);
    expect(shopRows()).toBe(1);
  });

  it('refuses the wrong name without checking the password', async () => {
    const res = await remove({ confirmName: 'Tia Lupe', currentPassword: PASSWORD });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('NAME_MISMATCH');
    expect(hashes.verify).not.toHaveBeenCalled();
    expect(shopRows()).toBe(1);
  });

  it('needs the password', async () => {
    const res = await remove({ confirmName: NAME });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('PASSWORD_REQUIRED');
    expect(shopRows()).toBe(1);
  });

  it('refuses a wrong password', async () => {
    const res = await remove({ confirmName: NAME, currentPassword: 'not the password at all' });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('PASSWORD_WRONG');
    expect(shopRows()).toBe(1);
  });

  it('stops hashing after ten wrong passwords (SR8, SR11)', async () => {
    vi.stubEnv('SHELFIE_TEST', '');
    for (let i = 0; i < 10; i++) await remove({ confirmName: NAME, currentPassword: 'not the password at all' });
    hashes.verify.mockClear();
    const res = await remove();
    expect(res.status).toBe(429);
    expect(hashes.verify).not.toHaveBeenCalled();
    expect(shopRows()).toBe(1);
  });

  it('answers 503 BUSY when the hash gate is full (SR7)', async () => {
    hashes.verify.mockRejectedValueOnce(new password.HashBusyError());
    const res = await remove();
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect(shopRows()).toBe(1);
  });

  it('refuses when the password changed during the check', async () => {
    hashes.verify.mockImplementationOnce(async () => {
      accounts.setPasswordHash(state.db, account.id, 'fake$something else');
      return true;
    });
    const res = await remove();
    expect((await errorOf(res)).code).toBe('PASSWORD_WRONG');
    expect(shopRows()).toBe(1);
  });

  it('writes nothing when the session ended during the check', async () => {
    hashes.verify.mockImplementationOnce(async () => {
      sessions.deleteForAccount(state.db, account.id);
      return true;
    });
    expect((await remove()).status).toBe(404);
    expect(shopRows()).toBe(1);
  });

  it.each(['approved', 'paid', 'payment_pending', 'awaiting_approval'])('is 409 OPEN_ORDERS with a %s order', async (status) => {
    placeOrder(shopId, status);
    const res = await remove();
    expect(res.status).toBe(409);
    const error = await errorOf(res);
    expect(error.code).toBe('OPEN_ORDERS');
    expect(error.message).toBe('1 order is still open. Hand it over, or wait for an unpaid one to expire (up to an hour), then try again.');
    expect(shopRows()).toBe(1);
    expect(retired(SLUG)).toBe(false);
  });

  it('counts the open orders in the message', async () => {
    placeOrder(shopId, 'paid');
    placeOrder(shopId, 'approved');
    expect((await errorOf(await remove())).message).toBe(
      '2 orders are still open. Hand them over, or wait for unpaid ones to expire (up to an hour), then try again.',
    );
  });

  it.each(['fulfilled', 'failed', 'cancelled', 'expired'])('allows a %s order', async (status) => {
    placeOrder(shopId, status);
    expect((await remove()).status).toBe(204);
  });

  it('allows an awaiting_approval order past its expiry', async () => {
    placeOrder(shopId, 'awaiting_approval', -1000);
    expect((await remove()).status).toBe(204);
  });

  describe('an unattached shop', () => {
    let token: string;
    beforeEach(() => {
      state.jar.clear();
      const made = liveShop('Guest Shop', null);
      shopId = made.shop.id;
      token = made.ownerToken;
      state.jar.set(ownerCookieName(shopId), token);
    });

    it('is 403 ACCOUNT_REQUIRED when guests are off', async () => {
      const res = await remove({ confirmName: 'Guest Shop', currentPassword: PASSWORD });
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe('ACCOUNT_REQUIRED');
      expect(shops.byId(state.db, shopId)).not.toBeNull();
    });

    it('can be deleted by its owner cookie when guests are on', async () => {
      state.guests = true;
      expect((await remove({ confirmName: 'Guest Shop' })).status).toBe(204);
      expect(shops.byId(state.db, shopId)).toBeNull();
      expect(retired('guest-shop')).toBe(true);
    });

    it('never deletes the demo shop, guests or not', async () => {
      state.guests = true;
      const { shop, ownerToken } = shops.create(state.db, { name: 'Marigold Bakehouse' });
      state.jar.set(ownerCookieName(shop.id), ownerToken);
      expect(shop.slug).toBe('marigold-bakehouse');
      const res = await deleteShop(del(`/api/shops/${shop.id}`, { confirmName: 'Marigold Bakehouse' }), ctx(shop.id));
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe('DEMO_SHOP');
      expect(shops.byId(state.db, shop.id)).not.toBeNull();
    });
  });
});

void [NEW_PASSWORD, sessionCookieName, hashToken];
