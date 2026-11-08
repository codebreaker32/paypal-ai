// POST /api/shops and the PayPal email change under concurrency: the 25-shop cap (SR17) and the rule for a change on a
// published shop (SR18) must hold against the row as it is when the write happens, not as it was when the request began.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('@/lib/auth/guest', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/guest')>()),
  guestShopsAllowed: () => false,
}));
vi.mock('@/lib/auth/password', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/password')>();
  return {
    ...real,
    hashPassword: vi.fn(async (p: string) => `fake$${p}`),
    verifyPassword: vi.fn(async (p: string, stored: string) => stored === `fake$${p}`),
  };
});

const { createTestDb } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const shops = await import('@/lib/db/repos/shops');
const { hashRecoveryKey } = await import('@/lib/auth/recovery');
const { verifyPassword } = await import('@/lib/auth/password');
const { startSession } = await import('@/lib/auth/session');
const { resetRateLimits } = await import('@/lib/rate-limit');
const { POST } = await import('@/app/api/shops/route');
const { PATCH } = await import('@/app/api/shops/[id]/route');
const { POST: recoverRoute } = await import('@/app/api/auth/recover/route');

const PASSWORD = 'a short sentence only rosa says';
const NEW_PASSWORD = 'a different sentence for the shop';
const KEY = 'ABCDE-FGHJK-LMNPQ-RSTUV';
const EMAIL = 'rosa@example.com';
const OLD = 'rosa@paypal.example';
const NEW = 'thief@paypal.example';
const THIRD = 'third@paypal.example';

const verify = vi.mocked(verifyPassword);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

function deferred() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

let accountId: string;

beforeEach(async () => {
  state.db = createTestDb();
  state.jar.clear();
  resetRateLimits();
  verify.mockClear();
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('RENDER', '');
  accountId = accounts.create(state.db, {
    email: EMAIL,
    passwordHash: `fake$${PASSWORD}`,
    recoveryHash: hashRecoveryKey(KEY),
    termsVersion: 'v1',
  }).id;
  await startSession(accountId);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/shops: the 25-shop cap under concurrency (SR17)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-races-'));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const postSample = () =>
    POST(
      new Request('http://localhost/api/shops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sample: 'ravi-bike-repair' }),
      }),
    );

  it('from 24 shops, concurrent POSTs yield exactly one 201 and the rest 409 SHOP_LIMIT', async () => {
    for (let i = 0; i < 24; i++) shops.create(state.db, { name: `Shop ${i}`, accountId });
    const results = await Promise.all(Array.from({ length: 5 }, postSample));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    const refused = results.find((r) => r.status === 409)!;
    expect(await errorCode(refused)).toBe('SHOP_LIMIT');
    expect(shops.listByAccount(state.db, accountId)).toHaveLength(25);
  });

  it('a refused POST leaves nothing on disk or in the database', async () => {
    for (let i = 0; i < 24; i++) shops.create(state.db, { name: `Shop ${i}`, accountId });
    await Promise.all(Array.from({ length: 3 }, postSample));
    const dirs = fs.readdirSync(dir).filter((d) => d.startsWith('shp_') || d === 'shops');
    expect(shops.listByAccount(state.db, accountId).filter((s) => s.menuPhotoPaths.length > 0)).toHaveLength(1);
    expect(dirs.length).toBeLessThanOrEqual(1);
  });

  it('counts each account on its own', async () => {
    const other = accounts.create(state.db, { email: 'other@example.com', passwordHash: 'x', recoveryHash: 'r', termsVersion: 'v1' }).id;
    for (let i = 0; i < 25; i++) shops.create(state.db, { name: `Shop ${i}`, accountId: other });
    expect((await postSample()).status).toBe(201);
  });
});

describe('PATCH /api/shops/[id]: the PayPal email on a stale row (SR18)', () => {
  const patch = (shopId: string, body: Record<string, unknown>) =>
    PATCH(new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) }), ctx(shopId));

  /** A PATCH whose body is still arriving: the route has read the shop, the body lands when `gate` opens. */
  function slowPatch(shopId: string, body: Record<string, unknown>, gate: Promise<void>) {
    const stream = new ReadableStream<Uint8Array>({
      async pull(c) {
        await gate;
        c.enqueue(new TextEncoder().encode(JSON.stringify(body)));
        c.close();
      },
    });
    return PATCH(new Request('http://localhost/x', { method: 'PATCH', body: stream, duplex: 'half' } as RequestInit), ctx(shopId));
  }

  function makeShop(status: 'draft' | 'live' | 'paused' = 'live') {
    const { shop } = shops.create(state.db, { name: 'Marigold', accountId, payeeEmail: OLD });
    if (status !== 'draft') shops.update(state.db, shop.id, { status });
    return shop.id;
  }
  const email = (shopId: string) => shops.byId(state.db, shopId)!.payeeEmail;
  const changes = (shopId: string) =>
    state.db.prepare('SELECT old_masked, new_masked FROM payee_changes WHERE shop_id = ? ORDER BY id').all(shopId) as {
      old_masked: string | null;
      new_masked: string;
    }[];

  it('a no-password change that started on a draft is refused once the shop has gone live', async () => {
    const id = makeShop('draft');
    const gate = deferred();
    const pending = slowPatch(id, { payeeEmail: NEW }, gate.opened);
    await new Promise((r) => setTimeout(r, 10));
    shops.update(state.db, id, { status: 'live' });
    gate.open();

    const res = await pending;
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('PASSWORD_REQUIRED');
    expect(email(id)).toBe(OLD);
    expect(changes(id)).toEqual([]);
  });

  it('a held "same email" PATCH cannot undo a verified change made meanwhile', async () => {
    const id = makeShop();
    const gate = deferred();
    const pending = slowPatch(id, { payeeEmail: OLD }, gate.opened);
    await new Promise((r) => setTimeout(r, 10));
    expect((await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD })).status).toBe(200);
    gate.open();

    const res = await pending;
    expect([403, 409]).toContain(res.status);
    expect(email(id)).toBe(NEW);
    expect(changes(id)).toHaveLength(1);
  });

  it('of two concurrent verified changes, the second is refused and the audit stays true', async () => {
    const id = makeShop();
    const gate = deferred();
    verify.mockImplementationOnce(async (p, stored) => {
      await gate.opened;
      return stored === `fake$${p}`;
    });
    const held = patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
    expect((await patch(id, { payeeEmail: THIRD, currentPassword: PASSWORD })).status).toBe(200);
    gate.open();

    const res = await held;
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe('SHOP_CHANGED');
    expect(email(id)).toBe(THIRD);
    expect(changes(id)).toEqual([expect.objectContaining({ old_masked: 'r•••@paypal.example', new_masked: 't•••@paypal.example' })]);
  });

  it('a change refused by a lost recovery race is PASSWORD_WRONG', async () => {
    const id = makeShop();
    const gate = deferred();
    verify.mockImplementationOnce(async (p, stored) => {
      await gate.opened;
      return stored === `fake$${p}`;
    });
    const held = patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
    const recovered = await recoverRoute(
      new Request('http://localhost/api/auth/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, recoveryKey: KEY, newPassword: NEW_PASSWORD }),
      }),
    );
    expect(recovered.status).toBe(200);
    gate.open();

    const res = await held;
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('PASSWORD_WRONG');
    expect(email(id)).toBe(OLD);
    expect(changes(id)).toEqual([]);
  });

  it('old_masked comes from the row inside the transaction', async () => {
    const id = makeShop();
    expect((await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD })).status).toBe(200);
    expect((await patch(id, { payeeEmail: THIRD, currentPassword: PASSWORD })).status).toBe(200);
    expect(changes(id).map((c) => c.old_masked)).toEqual(['r•••@paypal.example', 't•••@paypal.example']);
  });

  it('a patch of other fields is not refused because the email moved meanwhile', async () => {
    const id = makeShop();
    const gate = deferred();
    const pending = slowPatch(id, { name: 'Marigold Bakery' }, gate.opened);
    await new Promise((r) => setTimeout(r, 10));
    expect((await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD })).status).toBe(200);
    gate.open();

    expect((await pending).status).toBe(200);
    expect(shops.byId(state.db, id)!.name).toBe('Marigold Bakery');
    expect(email(id)).toBe(NEW);
  });

  it('a shop deleted while the body was arriving is 404', async () => {
    const id = makeShop('draft');
    const gate = deferred();
    const pending = slowPatch(id, { name: 'Marigold Bakery' }, gate.opened);
    await new Promise((r) => setTimeout(r, 10));
    state.db.prepare('DELETE FROM shops WHERE id = ?').run(id);
    gate.open();
    expect((await pending).status).toBe(404);
  });

  it('after 10 correct changes is 429 and hashes nothing', async () => {
    vi.stubEnv('SHELFIE_TEST', '');
    const id = makeShop();
    for (let i = 0; i < 10; i++) {
      expect((await patch(id, { payeeEmail: `seller${i}@paypal.example`, currentPassword: PASSWORD })).status).toBe(200);
    }
    verify.mockClear();
    const res = await patch(id, { payeeEmail: NEW, currentPassword: PASSWORD });
    expect(res.status).toBe(429);
    expect(verify).not.toHaveBeenCalled();
  });
});
