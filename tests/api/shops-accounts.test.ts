// POST /api/shops with accounts (SR17) and the PayPal email change on PATCH /api/shops/[id] (SR18).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  guests: true,
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
  return { ...real, verifyPassword: vi.fn(async (p: string, stored: string) => stored === `fake$${p}`) };
});

const { createTestDb } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const payeeChanges = await import('@/lib/db/repos/payee-changes');
const shops = await import('@/lib/db/repos/shops');
const { HashBusyError, verifyPassword } = await import('@/lib/auth/password');
const { ownerCookieName } = await import('@/lib/auth/owner');
const { sessionCookieName, startSession } = await import('@/lib/auth/session');
const { resetRateLimits } = await import('@/lib/rate-limit');
const { POST } = await import('@/app/api/shops/route');
const { PATCH } = await import('@/app/api/shops/[id]/route');

const PASSWORD = 'a short sentence only rosa says';
const verify = vi.mocked(verifyPassword);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;
const newAccount = (email = 'rosa@example.com') =>
  accounts.create(state.db, { email, passwordHash: `fake$${PASSWORD}`, recoveryHash: 'r', termsVersion: 'v1' });
const shopCount = () => (state.db.prepare('select count(*) as n from shops').get() as { n: number }).n;

/** A body that fails the test if anything reads it. */
function unreadBody(onRead: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream(
    {
      pull() {
        onRead();
        throw new Error('the body must not be read');
      },
    },
    { highWaterMark: 0 },
  );
}

const postJson = (body: unknown) =>
  new Request('http://localhost/api/shops', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const postSample = () => postJson({ sample: 'ravi-bike-repair' });
const postUnread = (onRead: () => void) =>
  new Request('http://localhost/api/shops', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: unreadBody(onRead),
    duplex: 'half',
  } as RequestInit);

beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  state.guests = true;
  resetRateLimits();
  verify.mockClear();
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('RENDER', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/shops', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-accounts-'));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('with guests off', () => {
    beforeEach(() => {
      state.guests = false;
    });

    it('is 401 LOGIN_REQUIRED with no session, before reading the body', async () => {
      let read = false;
      const res = await POST(postUnread(() => (read = true)));
      expect(res.status).toBe(401);
      expect(await errorCode(res)).toBe('LOGIN_REQUIRED');
      expect(read).toBe(false);
      expect(shopCount()).toBe(0);
    });

    it('is 401 with a dead session cookie', async () => {
      state.jar.set(sessionCookieName(), 'made-up-token');
      expect((await POST(postSample())).status).toBe(401);
    });

    it('never honours an owner cookie as a way in', async () => {
      const { shop, ownerToken } = shops.create(state.db, { name: 'Other' });
      state.jar.set(ownerCookieName(shop.id), ownerToken);
      expect((await POST(postSample())).status).toBe(401);
    });

    it('creates the shop for a logged-in seller', async () => {
      const account = newAccount();
      await startSession(account.id);
      const res = await POST(postSample());
      expect(res.status).toBe(201);
      const { shopId } = (await res.json()) as { shopId: string };
      expect(shops.byId(state.db, shopId)!.accountId).toBe(account.id);
    });
  });

  describe('with a session', () => {
    let accountId: string;
    beforeEach(async () => {
      accountId = newAccount().id;
      await startSession(accountId);
    });

    it('sets the account, no owner cookie, and returns no owner link', async () => {
      const res = await POST(postSample());
      expect(res.status).toBe(201);
      const body = (await res.json()) as { shopId: string };
      expect(Object.keys(body)).toEqual(['shopId']);
      expect(shops.byId(state.db, body.shopId)!.accountId).toBe(accountId);
      expect(state.jar.has(ownerCookieName(body.shopId))).toBe(false);
      expect([...state.jar.keys()].some((name) => name.startsWith('shelfie_owner_'))).toBe(false);
    });

    it('refuses the 26th shop with 409 SHOP_LIMIT, before reading the body', async () => {
      for (let i = 0; i < 25; i++) shops.create(state.db, { name: `Shop ${i}`, accountId });
      let read = false;
      const res = await POST(postUnread(() => (read = true)));
      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('SHOP_LIMIT');
      expect(read).toBe(false);
      expect(shops.listByAccount(state.db, accountId)).toHaveLength(25);
    });

    it('allows the 25th shop', async () => {
      for (let i = 0; i < 24; i++) shops.create(state.db, { name: `Shop ${i}`, accountId });
      expect((await POST(postSample())).status).toBe(201);
    });

    it('counts only this account’s shops', async () => {
      const other = newAccount('other@example.com').id;
      for (let i = 0; i < 25; i++) shops.create(state.db, { name: `Shop ${i}`, accountId: other });
      expect((await POST(postSample())).status).toBe(201);
    });
  });

  it('refuses a cross-site POST before anything happens (SR2)', async () => {
    let read = false;
    const req = new Request('http://localhost/api/shops', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: unreadBody(() => (read = true)),
      duplex: 'half',
    } as RequestInit);
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('BAD_ORIGIN');
    expect(read).toBe(false);
    expect(shopCount()).toBe(0);
  });

  it('with guests allowed and no session, stays as it was: an owner cookie and no account', async () => {
    const res = await POST(postSample());
    expect(res.status).toBe(201);
    const { shopId } = (await res.json()) as { shopId: string };
    expect(shops.byId(state.db, shopId)!.accountId).toBeNull();
    expect(state.jar.has(ownerCookieName(shopId))).toBe(true);
  });
});

describe('PATCH /api/shops/[id]: the PayPal email (SR18)', () => {
  const OLD = 'rosa@paypal.example';
  const NEW = 'thief@paypal.example';
  let accountId: string;

  const patch = (shopId: string, body: Record<string, unknown>) =>
    PATCH(new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) }), ctx(shopId));

  function accountShop(status: 'draft' | 'live' | 'paused' = 'live') {
    const { shop } = shops.create(state.db, { name: 'Marigold', accountId, payeeEmail: OLD });
    if (status !== 'draft') shops.update(state.db, shop.id, { status });
    return shop.id;
  }
  const email = (shopId: string) => shops.byId(state.db, shopId)!.payeeEmail;
  const changes = (shopId: string) =>
    state.db.prepare('SELECT * FROM payee_changes WHERE shop_id = ?').all(shopId) as {
      old_masked: string | null;
      new_masked: string;
      changed_at: string;
    }[];

  beforeEach(async () => {
    accountId = newAccount().id;
    await startSession(accountId);
  });

  it('with no password is 403 PASSWORD_REQUIRED and leaves the email unchanged', async () => {
    const id = accountShop();
    const res = await patch(id, { payeeEmail: NEW });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('PASSWORD_REQUIRED');
    expect(email(id)).toBe(OLD);
    expect(changes(id)).toEqual([]);
    expect(verify).not.toHaveBeenCalled();
  });

  it('with a wrong password is 403 PASSWORD_WRONG and leaves the email unchanged', async () => {
    const id = accountShop();
    const res = await patch(id, { payeeEmail: NEW, currentPassword: 'not the right sentence' });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('PASSWORD_WRONG');
    expect(email(id)).toBe(OLD);
    expect(changes(id)).toEqual([]);
  });

  it('with the password changes the email and records the change, masked', async () => {
    const id = accountShop();
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { shop: { payeeEmail: string } }).shop.payeeEmail).toBe(NEW);
    expect(email(id)).toBe(NEW);
    expect(changes(id)).toEqual([expect.objectContaining({ old_masked: 'r•••@paypal.example', new_masked: 't•••@paypal.example' })]);
  });

  it('exposes the last change for Settings', async () => {
    const id = accountShop();
    expect(payeeChanges.latest(state.db, id)).toBeNull();
    await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(payeeChanges.latest(state.db, id)).toMatchObject({ newMasked: 't•••@paypal.example', oldMasked: 'r•••@paypal.example' });
  });

  it('a paused shop still prompts', async () => {
    const id = accountShop('paused');
    expect((await patch(id, { payeeEmail: NEW })).status).toBe(403);
    expect(email(id)).toBe(OLD);
    expect((await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD })).status).toBe(200);
    expect(email(id)).toBe(NEW);
  });

  it('a draft shop needs no password and is not recorded', async () => {
    const id = accountShop('draft');
    expect((await patch(id, { payeeEmail: NEW })).status).toBe(200);
    expect(email(id)).toBe(NEW);
    expect(changes(id)).toEqual([]);
  });

  it('sending the same email needs no password and records nothing', async () => {
    const id = accountShop();
    expect((await patch(id, { payeeEmail: OLD })).status).toBe(200);
    expect(changes(id)).toEqual([]);
    expect((await patch(id, { payeeEmail: OLD.toUpperCase() })).status).toBe(200);
    expect(changes(id)).toEqual([]);
  });

  it('an edit to anything else needs no password', async () => {
    const id = accountShop();
    expect((await patch(id, { name: 'Marigold Bakery' })).status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
  });

  it('takes currentPassword out before validating the rest, even when it is not needed', async () => {
    const id = accountShop();
    const res = await patch(id, { name: 'Marigold Bakery', currentPassword: 'anything at all' });
    expect(res.status).toBe(200);
    expect(shops.byId(state.db, id)!.name).toBe('Marigold Bakery');
  });

  it('still refuses unknown fields and a malformed email, and a bad body', async () => {
    const id = accountShop();
    expect((await patch(id, { nope: 1 })).status).toBe(400);
    expect((await patch(id, { payeeEmail: 'nope', currentPassword: PASSWORD })).status).toBe(400);
    const notAnObject = await PATCH(new Request('http://localhost/x', { method: 'PATCH', body: '[1]' }), ctx(id));
    expect(notAnObject.status).toBe(400);
    expect(email(id)).toBe(OLD);
  });

  it('clearing a published shop’s email still needs the password, then is refused, and records nothing', async () => {
    const id = accountShop();
    expect((await patch(id, { payeeEmail: null })).status).toBe(403);
    const res = await patch(id, { payeeEmail: null, currentPassword: PASSWORD });
    expect(res.status).toBe(409);
    expect(email(id)).toBe(OLD);
    expect(changes(id)).toEqual([]);
  });

  it('writes the shop and the record in one transaction', async () => {
    const id = accountShop();
    state.db.exec('DROP TABLE payee_changes');
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(500);
    expect(email(id)).toBe(OLD);
  });

  it('after 10 wrong passwords is 429, and hashes nothing (SR8, SR11)', async () => {
    vi.stubEnv('SHELFIE_TEST', '');
    const id = accountShop();
    for (let i = 0; i < 10; i++) {
      expect((await patch(id, { payeeEmail: NEW, currentPassword: 'not the right sentence' })).status).toBe(403);
    }
    verify.mockClear();
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(429);
    expect(verify).not.toHaveBeenCalled();
    expect(email(id)).toBe(OLD);
  });

  it('answers 503 BUSY when the hash gate is full', async () => {
    const id = accountShop();
    verify.mockRejectedValueOnce(new HashBusyError());
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(email(id)).toBe(OLD);
  });

  it('an unattached published shop needs no password, and its change is still recorded', async () => {
    const { shop, ownerToken } = shops.create(state.db, { name: 'Seeded', payeeEmail: OLD });
    shops.update(state.db, shop.id, { status: 'live' });
    state.jar.set(ownerCookieName(shop.id), ownerToken);
    expect((await patch(shop.id, { payeeEmail: NEW })).status).toBe(200);
    expect(email(shop.id)).toBe(NEW);
    expect(changes(shop.id)).toHaveLength(1);
  });

  it('refuses a cross-site PATCH before anything happens (SR2)', async () => {
    const id = accountShop('draft');
    const res = await PATCH(
      new Request('http://localhost/x', { method: 'PATCH', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ payeeEmail: NEW }) }),
      ctx(id),
    );
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('BAD_ORIGIN');
    expect(email(id)).toBe(OLD);
  });

  it('another account gets 404, not a password prompt', async () => {
    const id = accountShop();
    await startSession(newAccount('mallory@example.com').id);
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(404);
    expect(email(id)).toBe(OLD);
  });
});
