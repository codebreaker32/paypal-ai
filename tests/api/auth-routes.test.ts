// The account routes: sign-up, login, logout, recovery and the recovery-key routes.
// Password hashing is stubbed: scrypt's real cost is tested in tests/auth/password.test.ts, and what matters here
// is which calls happen and in what order.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  written: new Map<string, { value: string; options: Record<string, unknown> }>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      state.written.set(name, { value, options });
      state.jar.set(name, value);
    },
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));
vi.mock('@/lib/auth/password', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/password')>();
  return {
    ...real,
    hashPassword: vi.fn(async (p: string) => `fake$${p}`),
    verifyPassword: vi.fn(async (p: string, stored: string) => stored === `fake$${p}`),
    dummyVerify: vi.fn(async () => {}),
    needsRehash: vi.fn(() => false),
  };
});

const { createTestDb } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const sessions = await import('@/lib/db/repos/sessions');
const shops = await import('@/lib/db/repos/shops');
const password = await import('@/lib/auth/password');
const { hashRecoveryKey } = await import('@/lib/auth/recovery');
const { RETURNING_COOKIE, sessionCookieName } = await import('@/lib/auth/session');
const { resetRateLimits } = await import('@/lib/rate-limit');
const { hashToken } = await import('@/lib/domain/ids');
const { TERMS_VERSION } = await import('@/lib/legal/version');
const { POST: signup } = await import('@/app/api/auth/signup/route');
const { POST: login } = await import('@/app/api/auth/login/route');
const { POST: logout } = await import('@/app/api/auth/logout/route');
const { POST: recover } = await import('@/app/api/auth/recover/route');
const { POST: newKey, PATCH: keySaved } = await import('@/app/api/account/recovery-key/route');

const EMAIL = 'rosa@example.com';
const PASSWORD = 'a short sentence only rosa says';
const NEW_PASSWORD = 'a different sentence for the shop';
const KEY = 'ABCDE-FGHJK-LMNPQ-RSTUV';

const hashes = {
  hash: vi.mocked(password.hashPassword),
  verify: vi.mocked(password.verifyPassword),
  dummy: vi.mocked(password.dummyVerify),
  rehash: vi.mocked(password.needsRehash),
};
const hashCalls = () => hashes.hash.mock.calls.length + hashes.verify.mock.calls.length + hashes.dummy.mock.calls.length;

const IP = { 'x-forwarded-for': '203.0.113.9' };
const req = (path: string, body?: unknown, headers: Record<string, string> = {}, method = 'POST') =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...IP, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; message: string } }).error;
const makeAccount = (email = EMAIL, pw = PASSWORD, key = KEY) =>
  accounts.create(state.db, { email, passwordHash: `fake$${pw}`, recoveryHash: hashRecoveryKey(key), termsVersion: 'v1' });
const sessionCount = (accountId: string) =>
  (state.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE account_id = ?').get(accountId) as { n: number }).n;
/** The limits are off under SHELFIE_TEST, which tests/setup.ts sets. */
const enforceLimits = () => vi.stubEnv('SHELFIE_TEST', '');

beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  state.written.clear();
  resetRateLimits();
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('RENDER', '');
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/auth/signup', () => {
  const body = { email: 'Rosa@Example.com ', password: PASSWORD };

  it('creates the account and a session, and hands over the recovery key once', async () => {
    const res = await signup(req('/api/auth/signup', body));
    expect(res.status).toBe(201);
    const { recoveryKey, next } = (await res.json()) as { recoveryKey: string; next: string };
    expect(recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect(next).toBe('/shops/new');
    const account = accounts.byEmail(state.db, EMAIL)!;
    expect(account.recoveryHash).toBe(hashRecoveryKey(recoveryKey));
    expect(account.passwordHash).toBe(`fake$${PASSWORD}`);
    expect(account.termsVersion).toBe(TERMS_VERSION);
    expect(account.recoverySavedAt).toBeNull();
    expect(sessionCount(account.id)).toBe(1);
    expect(state.jar.get(RETURNING_COOKIE)).toBe('1');
  });

  it('never stores the recovery key or the session token raw', async () => {
    const res = await signup(req('/api/auth/signup', body));
    const { recoveryKey } = (await res.json()) as { recoveryKey: string };
    const token = state.jar.get(sessionCookieName())!;
    const dump = JSON.stringify([state.db.prepare('SELECT * FROM accounts').all(), state.db.prepare('SELECT * FROM sessions').all()]);
    expect(dump).not.toContain(recoveryKey);
    expect(dump).not.toContain(recoveryKey.replaceAll('-', ''));
    expect(dump).not.toContain(token);
    expect(sessions.byTokenHash(state.db, hashToken(token))).not.toBeNull();
  });

  it('marks the key response no-store', async () => {
    const res = await signup(req('/api/auth/signup', body));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses a bad email with 400 INVALID_EMAIL and no hash', async () => {
    const res = await signup(req('/api/auth/signup', { email: 'nope', password: PASSWORD }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatchObject({ code: 'INVALID_EMAIL', message: 'Enter your email, like rosa@example.com.' });
    expect(hashCalls()).toBe(0);
  });

  it.each([
    ['too short', 'too short'],
    ['on the blocklist', 'correct horse battery staple'],
    ['one repeated character', 'aaaaaaaaaaaaaaaaaaaa'],
    ['the email', 'rosa@example.com'],
  ])('refuses a password that is %s with 400 WEAK_PASSWORD and no hash', async (_, weak) => {
    const res = await signup(req('/api/auth/signup', { email: EMAIL, password: weak }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('WEAK_PASSWORD');
    expect(hashCalls()).toBe(0);
    expect(accounts.byEmail(state.db, EMAIL)).toBeNull();
  });

  it('refuses an email already taken with 409 EMAIL_TAKEN, whatever its case', async () => {
    makeAccount();
    const res = await signup(req('/api/auth/signup', { email: 'ROSA@EXAMPLE.COM', password: PASSWORD }));
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe('EMAIL_TAKEN');
  });

  it('answers EMAIL_TAKEN when two sign-ups race for one address', async () => {
    const [a, b] = await Promise.all([
      signup(req('/api/auth/signup', { email: EMAIL, password: PASSWORD })),
      signup(req('/api/auth/signup', { email: EMAIL, password: NEW_PASSWORD })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('answers a body that is not JSON as an invalid email', async () => {
    const res = await signup(new Request('http://localhost/api/auth/signup', { method: 'POST', body: '{nope' }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('INVALID_EMAIL');
  });

  it('answers 503 BUSY with Retry-After when the hash gate is full', async () => {
    hashes.hash.mockRejectedValueOnce(new password.HashBusyError());
    const res = await signup(req('/api/auth/signup', { email: EMAIL, password: PASSWORD }));
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('BUSY');
    expect(res.headers.get('retry-after')).toBe('5');
    expect(accounts.byEmail(state.db, EMAIL)).toBeNull();
  });

  it('after 10 sign-ups from one address is 429, before any hash', async () => {
    enforceLimits();
    for (let i = 0; i < 10; i++) {
      expect((await signup(req('/api/auth/signup', { email: `u${i}@example.com`, password: PASSWORD }))).status).toBe(201);
    }
    hashes.hash.mockClear();
    const res = await signup(req('/api/auth/signup', { email: 'u11@example.com', password: PASSWORD }));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('RATE_LIMITED');
    expect(hashCalls()).toBe(0);
  });

  it('counts a rate-limited address before reading a bad body', async () => {
    enforceLimits();
    for (let i = 0; i < 10; i++) await signup(req('/api/auth/signup', { email: 'nope', password: 'x' }));
    expect((await signup(req('/api/auth/signup', { email: EMAIL, password: PASSWORD }))).status).toBe(429);
  });
});

describe('POST /api/auth/login', () => {
  const creds = { email: EMAIL, password: PASSWORD };

  it('logs in, starts a session and goes to the landing path', async () => {
    const account = makeAccount();
    const res = await login(req('/api/auth/login', creds));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ next: '/shops/new' });
    expect(sessionCount(account.id)).toBe(1);
    expect(state.written.get(sessionCookieName())?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
    expect(state.written.get(RETURNING_COOKIE)?.value).toBe('1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('takes a typed email in any case', async () => {
    makeAccount();
    expect((await login(req('/api/auth/login', { ...creds, email: ' ROSA@example.COM' }))).status).toBe(200);
  });

  it('goes to the dashboard for one shop and to its setup for one draft', async () => {
    const account = makeAccount();
    const { shop } = shops.create(state.db, { name: 'Marigold', accountId: account.id });
    expect(await (await login(req('/api/auth/login', creds))).json()).toEqual({ next: `/shops/${shop.id}/setup` });
    shops.publish(state.db, shop.id);
    expect(await (await login(req('/api/auth/login', creds))).json()).toEqual({ next: `/shops/${shop.id}` });
  });

  it('follows a safe next', async () => {
    makeAccount();
    const res = await login(req('/api/auth/login', { ...creds, next: '/shops/shp_123/orders' }));
    expect(await res.json()).toEqual({ next: '/shops/shp_123/orders' });
  });

  it.each(['//evil.example', 'https://evil.example/x', '/claim/abc', '/api/shops', '/\\evil.example'])(
    'ignores the unsafe next %s',
    async (next) => {
      makeAccount();
      expect(await (await login(req('/api/auth/login', { ...creds, next }))).json()).toEqual({ next: '/shops/new' });
    },
  );

  it('answers an unknown email and a wrong password identically', async () => {
    makeAccount();
    const wrong = await login(req('/api/auth/login', { email: EMAIL, password: 'not the right sentence' }));
    const unknown = await login(req('/api/auth/login', { email: 'nobody@example.com', password: 'not the right sentence' }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const [a, b] = [await wrong.json(), await unknown.json()];
    expect(a).toEqual(b);
    expect(a).toMatchObject({ error: { code: 'BAD_CREDENTIALS' } });
  });

  it('runs a dummy hash for an unknown email, and the real check for a known one', async () => {
    await login(req('/api/auth/login', { email: 'nobody@example.com', password: 'whatever it is here' }));
    expect(hashes.dummy).toHaveBeenCalledTimes(1);
    expect(hashes.verify).not.toHaveBeenCalled();
    hashes.dummy.mockClear();
    makeAccount();
    await login(req('/api/auth/login', creds));
    expect(hashes.dummy).not.toHaveBeenCalled();
    expect(hashes.verify).toHaveBeenCalledTimes(1);
  });

  it('answers a malformed request the same as a wrong password, and still hashes', async () => {
    const res = await login(req('/api/auth/login', { email: 'nope', password: 7 }));
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe('BAD_CREDENTIALS');
    expect(hashes.dummy).toHaveBeenCalledTimes(1);
    const noBody = await login(new Request('http://localhost/api/auth/login', { method: 'POST', body: 'not json' }));
    expect(noBody.status).toBe(401);
  });

  it('sets no session on a failed login', async () => {
    makeAccount();
    await login(req('/api/auth/login', { email: EMAIL, password: 'not the right sentence' }));
    expect(state.jar.has(sessionCookieName())).toBe(false);
  });

  it('stores a fresh hash when the old one is out of date', async () => {
    const account = makeAccount();
    hashes.rehash.mockReturnValueOnce(true);
    hashes.hash.mockResolvedValueOnce('rehashed');
    await login(req('/api/auth/login', creds));
    expect(accounts.byId(state.db, account.id)!.passwordHash).toBe('rehashed');
    expect(accounts.byId(state.db, account.id)!.passwordChangedAt).toBe(account.passwordChangedAt);
  });

  it('a logged-in visitor’s login replaces only this browser’s session', async () => {
    const account = makeAccount();
    await login(req('/api/auth/login', creds));
    const first = state.jar.get(sessionCookieName());
    await login(req('/api/auth/login', creds));
    expect(state.jar.get(sessionCookieName())).not.toBe(first);
    expect(sessionCount(account.id)).toBe(1);
  });

  it('answers 503 BUSY with Retry-After, and does not count a failure', async () => {
    enforceLimits();
    makeAccount();
    hashes.verify.mockRejectedValue(new password.HashBusyError());
    for (let i = 0; i < 12; i++) {
      const res = await login(req('/api/auth/login', creds));
      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('5');
    }
    hashes.verify.mockReset();
    hashes.verify.mockImplementation(async (p: string, stored: string) => stored === `fake$${p}`);
    expect((await login(req('/api/auth/login', creds))).status).toBe(200);
  });

  describe('limits', () => {
    beforeEach(() => {
      enforceLimits();
      makeAccount();
    });
    const wrong = { email: EMAIL, password: 'not the right sentence' };

    it('after 10 failures for an email from an address is 429, and hashes nothing', async () => {
      for (let i = 0; i < 10; i++) expect((await login(req('/api/auth/login', wrong))).status).toBe(401);
      vi.clearAllMocks();
      const res = await login(req('/api/auth/login', wrong));
      expect(res.status).toBe(429);
      expect((await errorOf(res)).code).toBe('RATE_LIMITED');
      expect(hashCalls()).toBe(0);
    });

    it('keeps the 429 for the right password too, once the limit is reached', async () => {
      for (let i = 0; i < 10; i++) await login(req('/api/auth/login', wrong));
      expect((await login(req('/api/auth/login', creds))).status).toBe(429);
    });

    it('counts failures for an email that has no account, with the same 429', async () => {
      const nobody = { email: 'nobody@example.com', password: 'whatever it is here' };
      for (let i = 0; i < 10; i++) expect((await login(req('/api/auth/login', nobody))).status).toBe(401);
      expect((await login(req('/api/auth/login', nobody))).status).toBe(429);
    });

    it('does not count a successful login', async () => {
      for (let i = 0; i < 12; i++) expect((await login(req('/api/auth/login', creds))).status).toBe(200);
    });

    it('does not lock out the same email from another address', async () => {
      for (let i = 0; i < 10; i++) await login(req('/api/auth/login', wrong));
      expect((await login(req('/api/auth/login', creds, { 'x-forwarded-for': '198.51.100.4' }))).status).toBe(200);
    });

    it('after 10 failures login is 429 and recovery still succeeds', async () => {
      for (let i = 0; i < 10; i++) await login(req('/api/auth/login', wrong));
      expect((await login(req('/api/auth/login', wrong))).status).toBe(429);
      const res = await recover(req('/api/auth/recover', { email: EMAIL, recoveryKey: KEY, newPassword: NEW_PASSWORD }));
      expect(res.status).toBe(200);
    });

    it('stops an address after 50 attempts, before any hash', async () => {
      for (let i = 0; i < 50; i++) await login(req('/api/auth/login', { email: `u${i}@example.com`, password: 'a password here now' }));
      vi.clearAllMocks();
      expect((await login(req('/api/auth/login', { email: 'fresh@example.com', password: 'a password here now' }))).status).toBe(429);
      expect(hashCalls()).toBe(0);
    });
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session, clears the cookie and keeps the returning cookie', async () => {
    const account = makeAccount();
    await login(req('/api/auth/login', { email: EMAIL, password: PASSWORD }));
    const res = await logout(req('/api/auth/logout'));
    expect(res.status).toBe(204);
    expect(sessionCount(account.id)).toBe(0);
    expect(state.written.get(sessionCookieName())).toMatchObject({ value: '', options: { maxAge: 0, path: '/' } });
    expect(state.jar.get(RETURNING_COOKIE)).toBe('1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('is 204 with no session', async () => {
    expect((await logout(req('/api/auth/logout'))).status).toBe(204);
  });
});

describe('POST /api/auth/recover', () => {
  const body = { email: EMAIL, recoveryKey: KEY, newPassword: NEW_PASSWORD };

  it('sets the new password, ends every session, starts a new one and hands over a new key', async () => {
    const account = makeAccount();
    sessions.create(state.db, { tokenHash: hashToken('old-device'), accountId: account.id, expiresAt: new Date(Date.now() + 1e6).toISOString() });
    const res = await recover(req('/api/auth/recover', body));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const out = (await res.json()) as { recoveryKey: string; next: string };
    expect(out.recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect(out.recoveryKey).not.toBe(KEY);
    expect(out.next).toBe('/shops/new');
    const after = accounts.byId(state.db, account.id)!;
    expect(after.passwordHash).toBe(`fake$${NEW_PASSWORD}`);
    expect(after.recoveryHash).toBe(hashRecoveryKey(out.recoveryKey));
    expect(after.recoverySavedAt).toBeNull();
    expect(sessions.byTokenHash(state.db, hashToken('old-device'))).toBeNull();
    expect(sessionCount(account.id)).toBe(1);
  });

  it('refuses the same key a second time', async () => {
    makeAccount();
    expect((await recover(req('/api/auth/recover', body))).status).toBe(200);
    const again = await recover(req('/api/auth/recover', { ...body, newPassword: 'yet another sentence for it' }));
    expect(again.status).toBe(401);
  });

  it('accepts the key typed loosely', async () => {
    makeAccount();
    expect((await recover(req('/api/auth/recover', { ...body, recoveryKey: 'abcdefghjklmnpqrstuv' }))).status).toBe(200);
  });

  it('answers a wrong key and an unknown email identically, and hashes in both', async () => {
    makeAccount();
    const wrong = await recover(req('/api/auth/recover', { ...body, recoveryKey: 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ' }));
    const unknown = await recover(req('/api/auth/recover', { ...body, email: 'nobody@example.com' }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const [a, b] = [await wrong.json(), await unknown.json()];
    expect(a).toEqual(b);
    expect(a).toMatchObject({ error: { code: 'BAD_RECOVERY' } });
    expect(hashes.hash).toHaveBeenCalledTimes(2);
  });

  it('hashes even for a malformed email', async () => {
    const res = await recover(req('/api/auth/recover', { ...body, email: 'nope' }));
    expect(res.status).toBe(401);
    expect(hashes.hash).toHaveBeenCalledTimes(1);
  });

  it('refuses a weak new password with 400 WEAK_PASSWORD and changes nothing', async () => {
    const account = makeAccount();
    const res = await recover(req('/api/auth/recover', { ...body, newPassword: 'short' }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('WEAK_PASSWORD');
    expect(accounts.byId(state.db, account.id)!.passwordHash).toBe(account.passwordHash);
  });

  it('refuses a new password equal to the account’s email', async () => {
    makeAccount('a-long-address-here@example.com');
    const res = await recover(req('/api/auth/recover', { ...body, email: 'a-long-address-here@example.com', newPassword: 'A-Long-Address-Here@example.com' }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('WEAK_PASSWORD');
  });

  it('of two concurrent uses, exactly one succeeds', async () => {
    const account = makeAccount();
    const [a, b] = await Promise.all([
      recover(req('/api/auth/recover', body)),
      recover(req('/api/auth/recover', { ...body, newPassword: 'the other concurrent sentence' })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
    expect(sessionCount(account.id)).toBe(1);
  });

  it('answers 503 BUSY when the hash gate is full, and does not count a failure', async () => {
    enforceLimits();
    makeAccount();
    hashes.hash.mockRejectedValue(new password.HashBusyError());
    for (let i = 0; i < 8; i++) {
      const res = await recover(req('/api/auth/recover', body));
      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('5');
    }
    hashes.hash.mockReset();
    hashes.hash.mockImplementation(async (p: string) => `fake$${p}`);
    expect((await recover(req('/api/auth/recover', body))).status).toBe(200);
  });

  describe('limits', () => {
    beforeEach(() => {
      enforceLimits();
      makeAccount();
    });
    const wrong = { ...body, recoveryKey: 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ' };

    it('after 5 failures for an email from an address is 429, and hashes nothing', async () => {
      for (let i = 0; i < 5; i++) expect((await recover(req('/api/auth/recover', wrong))).status).toBe(401);
      vi.clearAllMocks();
      const res = await recover(req('/api/auth/recover', wrong));
      expect(res.status).toBe(429);
      expect((await errorOf(res)).code).toBe('RATE_LIMITED');
      expect(hashCalls()).toBe(0);
    });

    it('stops an address after 10 attempts, before any hash', async () => {
      for (let i = 0; i < 10; i++) await recover(req('/api/auth/recover', { ...wrong, email: `u${i}@example.com` }));
      vi.clearAllMocks();
      expect((await recover(req('/api/auth/recover', { ...wrong, email: 'fresh@example.com' }))).status).toBe(429);
      expect(hashCalls()).toBe(0);
    });

    it('recovery failures do not lock the login', async () => {
      for (let i = 0; i < 5; i++) await recover(req('/api/auth/recover', wrong));
      expect((await login(req('/api/auth/login', { email: EMAIL, password: PASSWORD }))).status).toBe(200);
    });
  });
});

describe('the recovery-key routes', () => {
  const asRosa = async () => {
    const account = makeAccount();
    await login(req('/api/auth/login', { email: EMAIL, password: PASSWORD }));
    vi.clearAllMocks();
    return account;
  };

  describe('POST /api/account/recovery-key', () => {
    it('with the password, replaces the key and hands over the new one, no-store', async () => {
      const account = await asRosa();
      accounts.markRecoverySaved(state.db, account.id);
      const res = await newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }));
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const { recoveryKey } = (await res.json()) as { recoveryKey: string };
      expect(recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
      const after = accounts.byId(state.db, account.id)!;
      expect(after.recoveryHash).toBe(hashRecoveryKey(recoveryKey));
      expect(after.recoverySavedAt).toBeNull();
    });

    it('cancels the old key', async () => {
      await asRosa();
      await newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }));
      const res = await recover(req('/api/auth/recover', { email: EMAIL, recoveryKey: KEY, newPassword: NEW_PASSWORD }));
      expect(res.status).toBe(401);
    });

    it('is 401 with no session', async () => {
      const res = await newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }));
      expect(res.status).toBe(401);
      expect((await errorOf(res)).code).toBe('LOGIN_REQUIRED');
      expect(hashCalls()).toBe(0);
    });

    it('with no password is 403 PASSWORD_REQUIRED, and hashes nothing', async () => {
      const account = await asRosa();
      const res = await newKey(req('/api/account/recovery-key', {}));
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe('PASSWORD_REQUIRED');
      expect(hashCalls()).toBe(0);
      expect(accounts.byId(state.db, account.id)!.recoveryHash).toBe(hashRecoveryKey(KEY));
    });

    it('with a wrong password is 403 PASSWORD_WRONG and keeps the key', async () => {
      const account = await asRosa();
      const res = await newKey(req('/api/account/recovery-key', { currentPassword: 'not the right sentence' }));
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe('PASSWORD_WRONG');
      expect(accounts.byId(state.db, account.id)!.recoveryHash).toBe(hashRecoveryKey(KEY));
    });

    it('after 10 wrong passwords is 429, and hashes nothing', async () => {
      enforceLimits();
      await asRosa();
      for (let i = 0; i < 10; i++) {
        expect((await newKey(req('/api/account/recovery-key', { currentPassword: 'not the right sentence' }))).status).toBe(403);
      }
      vi.clearAllMocks();
      const res = await newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }));
      expect(res.status).toBe(429);
      expect(hashCalls()).toBe(0);
    });

    it('answers 503 BUSY when the hash gate is full', async () => {
      await asRosa();
      hashes.verify.mockRejectedValueOnce(new password.HashBusyError());
      const res = await newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }));
      expect(res.status).toBe(503);
    });
  });

  describe('PATCH /api/account/recovery-key', () => {
    it('marks the key saved and answers 204', async () => {
      const account = await asRosa();
      const res = await keySaved(req('/api/account/recovery-key', undefined, {}, 'PATCH'));
      expect(res.status).toBe(204);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(accounts.byId(state.db, account.id)!.recoverySavedAt).not.toBeNull();
    });

    it('is 401 with no session', async () => {
      const res = await keySaved(req('/api/account/recovery-key', undefined, {}, 'PATCH'));
      expect(res.status).toBe(401);
      expect((await errorOf(res)).code).toBe('LOGIN_REQUIRED');
    });
  });
});

describe('cross-site requests', () => {
  const evil = { origin: 'https://evil.example' };

  it.each([
    ['signup', () => signup(req('/api/auth/signup', { email: EMAIL, password: PASSWORD }, evil))],
    ['login', () => login(req('/api/auth/login', { email: EMAIL, password: PASSWORD }, evil))],
    ['logout', () => logout(req('/api/auth/logout', undefined, evil))],
    ['recover', () => recover(req('/api/auth/recover', { email: EMAIL, recoveryKey: KEY, newPassword: NEW_PASSWORD }, evil))],
    ['new key', () => newKey(req('/api/account/recovery-key', { currentPassword: PASSWORD }, evil))],
    ['key saved', () => keySaved(req('/api/account/recovery-key', undefined, evil, 'PATCH'))],
  ])('%s is refused before anything happens', async (_, call) => {
    makeAccount();
    const res = await call();
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('BAD_ORIGIN');
    expect(hashCalls()).toBe(0);
    expect(state.jar.size).toBe(0);
  });
});
