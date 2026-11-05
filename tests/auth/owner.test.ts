// Owner auth (spec §11): the owner cookie, the 404 for anyone else, and the /claim/<token> link.
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
const shops = await import('@/lib/db/repos/shops');
const { getOwnedShop, ownerCookieName, requireOwner } = await import('@/lib/auth/owner');
const { GET: claim } = await import('@/app/claim/[token]/route');
const { PATCH: patchShop } = await import('@/app/api/shops/[id]/route');

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

describe('owner auth', () => {
  let shopId: string;
  let token: string;

  beforeEach(() => {
    state.db = createTestDb();
    state.jar.clear();
    ({ shop: { id: shopId }, ownerToken: token } = shops.create(state.db, { name: 'Marigold' }));
  });

  it('recognises the owner by the cookie for that shop', async () => {
    state.jar.set(ownerCookieName(shopId), token);
    expect((await getOwnedShop(shopId))?.id).toBe(shopId);
  });

  it('rejects a wrong token, a missing cookie and another shop\'s token', async () => {
    expect(await getOwnedShop(shopId)).toBeNull();
    state.jar.set(ownerCookieName(shopId), 'not-the-token');
    expect(await getOwnedShop(shopId)).toBeNull();
    const other = shops.create(state.db, { name: 'Other' });
    state.jar.set(ownerCookieName(shopId), other.ownerToken);
    expect(await getOwnedShop(shopId)).toBeNull();
    await expect(requireOwner(shopId)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('answers 404 JSON to a non-owner on an owner route', async () => {
    const res = await patchShop(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ name: 'Mine now' }) }),
      ctx({ id: shopId }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(shops.byId(state.db, shopId)!.name).toBe('Marigold');
  });

  it('the owner link sets the cookie and sends the browser to the dashboard', async () => {
    const res = await claim(new Request(`http://x/claim/${token}`), ctx({ token }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/shops/${shopId}`);
    expect(state.jar.get(ownerCookieName(shopId))).toBe(token);
    expect((await getOwnedShop(shopId))?.id).toBe(shopId);
  });

  it('an unknown owner link is a 404 and sets nothing', async () => {
    const bogus = 'x'.repeat(43);
    const res = await claim(new Request(`http://x/claim/${bogus}`), ctx({ token: bogus }));
    expect(res.status).toBe(404);
    expect(state.jar.size).toBe(0);
  });
});
