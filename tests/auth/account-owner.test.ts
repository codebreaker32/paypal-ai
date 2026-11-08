// Who owns an account-owned shop (SR15): its account's session, and never an owner token.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));

const { createTestDb } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const shops = await import('@/lib/db/repos/shops');
const { getOwnedShop, listOwnedShops, ownerCookieName, requireOwner } = await import('@/lib/auth/owner');
const { RETURNING_COOKIE, sessionCookieName, startSession } = await import('@/lib/auth/session');
const { GET: claim } = await import('@/app/claim/[token]/route');
const { PATCH: patchShop } = await import('@/app/api/shops/[id]/route');

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
const newAccount = (email: string) =>
  accounts.create(state.db, { email, passwordHash: 'h', recoveryHash: 'r', termsVersion: 'v1' });
const rename = (shopId: string, name: string) =>
  patchShop(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ name }) }), ctx({ id: shopId }));

describe('an account-owned shop', () => {
  let accountId: string;
  let shopId: string;
  let token: string;

  beforeEach(() => {
    state.db = createTestDb();
    state.jar.clear();
    accountId = newAccount('rosa@example.com').id;
    ({ shop: { id: shopId }, ownerToken: token } = shops.create(state.db, { name: 'Marigold', accountId }));
  });

  it('opens with its account’s session and no owner cookie', async () => {
    await startSession(accountId);
    expect((await getOwnedShop(shopId))?.id).toBe(shopId);
    expect((await requireOwner(shopId)).id).toBe(shopId);
  });

  it('is never opened by its owner token', async () => {
    state.jar.set(ownerCookieName(shopId), token);
    expect(await getOwnedShop(shopId)).toBeNull();
  });

  it('is not opened by another account, even one holding the owner token', async () => {
    state.jar.set(ownerCookieName(shopId), token);
    await startSession(newAccount('mallory@example.com').id);
    expect(await getOwnedShop(shopId)).toBeNull();
  });

  it('answers another account 404 on an owner page, even after a past login in this browser', async () => {
    await startSession(newAccount('mallory@example.com').id);
    expect(state.jar.get(RETURNING_COOKIE)).toBe('1');
    await expect(requireOwner(shopId)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('answers another account 404 on an owner API route and changes nothing', async () => {
    await startSession(newAccount('mallory@example.com').id);
    const res = await rename(shopId, 'Mine now');
    expect(res.status).toBe(404);
    expect(shops.byId(state.db, shopId)!.name).toBe('Marigold');
  });

  it('lets its account use an owner API route with no owner cookie', async () => {
    await startSession(accountId);
    expect((await rename(shopId, 'Rosa’s')).status).toBe(200);
    expect(shops.byId(state.db, shopId)!.name).toBe('Rosa’s');
  });

  it('is a 404 at its owner link, which sets nothing', async () => {
    const res = await claim(new Request(`http://x/claim/${token}`), ctx({ token }));
    expect(res.status).toBe(404);
    expect(state.jar.size).toBe(0);
  });

  it('is left out of the owner-cookie list, even with a valid token', async () => {
    state.jar.set(ownerCookieName(shopId), token);
    expect(await listOwnedShops()).toEqual([]);
  });

  describe('requireOwner with no valid session', () => {
    const redirectsToLogin = () =>
      expect(requireOwner(shopId)).rejects.toMatchObject({
        digest: expect.stringContaining(`/login?next=/shops/${shopId}`),
      });

    it('sends a returning browser to log in and come back', async () => {
      state.jar.set(RETURNING_COOKIE, '1');
      await redirectsToLogin();
    });

    it('sends a returning browser with a dead session to log in', async () => {
      state.jar.set(RETURNING_COOKIE, '1');
      state.jar.set(sessionCookieName(), 'made-up-token');
      await redirectsToLogin();
    });

    it('is a 404 for a browser that has never logged in', async () => {
      await expect(requireOwner(shopId)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    });
  });
});

describe('an unattached shop', () => {
  let shopId: string;
  let token: string;

  beforeEach(() => {
    state.db = createTestDb();
    state.jar.clear();
    ({ shop: { id: shopId }, ownerToken: token } = shops.create(state.db, { name: 'Seeded' }));
  });

  it('still opens with its owner cookie, and is still listed', async () => {
    state.jar.set(ownerCookieName(shopId), token);
    expect((await getOwnedShop(shopId))?.id).toBe(shopId);
    expect((await listOwnedShops()).map((s) => s.id)).toEqual([shopId]);
  });

  it('does not open for a logged-in account with no owner cookie', async () => {
    await startSession(newAccount('rosa@example.com').id);
    expect(await getOwnedShop(shopId)).toBeNull();
  });
});
