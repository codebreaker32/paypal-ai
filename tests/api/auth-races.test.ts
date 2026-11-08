// The account routes under concurrency: what happens when a request is waiting on a password hash while another one
// changes the row, and how many hashes a burst can buy (the review's hash-gate, login-race and failure-limit findings).
// Hashing is stubbed with a deferred promise, so the interleaving is exact.
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
const password = await import('@/lib/auth/password');
const { hashRecoveryKey } = await import('@/lib/auth/recovery');
const { startSession } = await import('@/lib/auth/session');
const { resetRateLimits } = await import('@/lib/rate-limit');
const { POST: loginRoute } = await import('@/app/api/auth/login/route');
const { POST: recoverRoute } = await import('@/app/api/auth/recover/route');
const { POST: rotateRoute } = await import('@/app/api/account/recovery-key/route');

const EMAIL = 'rosa@example.com';
const OLD_PASSWORD = 'a short sentence only rosa says';
const NEW_PASSWORD = 'a different sentence for the shop';
const KEY = 'ABCDE-FGHJK-LMNPQ-RSTUV';

const hashes = {
  hash: vi.mocked(password.hashPassword),
  verify: vi.mocked(password.verifyPassword),
  dummy: vi.mocked(password.dummyVerify),
  rehash: vi.mocked(password.needsRehash),
};
const { HashBusyError } = password;

const post = (path: string, body: unknown, ip = '203.0.113.9') =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

const makeAccount = (email = EMAIL, pw = OLD_PASSWORD, key = KEY) =>
  accounts.create(state.db, { email, passwordHash: `fake$${pw}`, recoveryHash: hashRecoveryKey(key), termsVersion: 'v1' });
const sessionCount = (accountId: string) =>
  (state.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE account_id = ?').get(accountId) as { n: number }).n;

const login = (pw = OLD_PASSWORD, email = EMAIL, ip?: string) => loginRoute(post('/api/auth/login', { email, password: pw }, ip));
const recover = (key = KEY, ip?: string) => recoverRoute(post('/api/auth/recover', { email: EMAIL, recoveryKey: key, newPassword: NEW_PASSWORD }, ip));
const rotate = (pw = OLD_PASSWORD, ip?: string) => rotateRoute(post('/api/account/recovery-key', { currentPassword: pw }, ip));

function deferred() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

/** The next verifyPassword waits for `gate`, then answers as usual. */
function holdNextVerify(gate: Promise<void>) {
  hashes.verify.mockImplementationOnce(async (p, stored) => {
    await gate;
    return stored === `fake$${p}`;
  });
}

beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  resetRateLimits();
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('RENDER', '');
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

const enforceLimits = () => vi.stubEnv('SHELFIE_TEST', '');

describe('a login that overlaps recovery', () => {
  it('gets BAD_CREDENTIALS and no session when recovery commits during its verify', async () => {
    const account = makeAccount();
    const gate = deferred();
    holdNextVerify(gate.opened);
    const pending = login();
    await vi.waitFor(() => expect(hashes.verify).toHaveBeenCalledOnce());

    expect((await recover()).status).toBe(200);
    state.jar.clear(); // recovery's cookie belongs to another browser
    gate.open();

    const res = await pending;
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('BAD_CREDENTIALS');
    expect(sessionCount(account.id)).toBe(1);
  });

  it('counts the lost race as a failure', async () => {
    enforceLimits();
    makeAccount();
    const gate = deferred();
    holdNextVerify(gate.opened);
    const pending = login();
    await vi.waitFor(() => expect(hashes.verify).toHaveBeenCalledOnce());
    expect((await recover()).status).toBe(200);
    gate.open();
    expect((await pending).status).toBe(401);

    for (let i = 0; i < 9; i++) expect((await login('another wrong sentence here')).status).toBe(401);
    expect((await login('another wrong sentence here')).status).toBe(429);
  });

  it('with an unchanged password still logs in', async () => {
    const account = makeAccount();
    expect((await login()).status).toBe(200);
    expect(sessionCount(account.id)).toBe(1);
  });
});

describe('the rehash on login', () => {
  it('cannot overwrite the password recovery just set', async () => {
    makeAccount();
    hashes.rehash.mockReturnValueOnce(true);
    const gate = deferred();
    hashes.hash.mockImplementationOnce(async (p) => {
      await gate.opened;
      return `fake$rehashed-${p}`;
    });
    const pending = login();
    await vi.waitFor(() => expect(hashes.hash).toHaveBeenCalledOnce());

    expect((await recover()).status).toBe(200);
    gate.open();

    expect((await pending).status).toBe(401);
    expect(accounts.byEmail(state.db, EMAIL)!.passwordHash).toBe(`fake$${NEW_PASSWORD}`);
    expect((await login()).status).toBe(401);
  });

  it('stores the stronger hash when nothing raced, and the login succeeds', async () => {
    const account = makeAccount();
    hashes.rehash.mockReturnValueOnce(true);
    hashes.hash.mockImplementationOnce(async (p) => `fake$rehashed-${p}`);
    expect((await login()).status).toBe(200);
    expect(accounts.byEmail(state.db, EMAIL)!.passwordHash).toBe(`fake$rehashed-${OLD_PASSWORD}`);
    expect(sessionCount(account.id)).toBe(1);
  });
});

describe('a key rotation that overlaps recovery', () => {
  it('answers PASSWORD_WRONG and leaves the key recovery issued', async () => {
    const account = makeAccount();
    await startSession(account.id);
    const gate = deferred();
    holdNextVerify(gate.opened);
    const pending = rotate();
    await vi.waitFor(() => expect(hashes.verify).toHaveBeenCalledOnce());

    const recovered = await recover();
    expect(recovered.status).toBe(200);
    const { recoveryKey } = (await recovered.json()) as { recoveryKey: string };
    gate.open();

    const res = await pending;
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('PASSWORD_WRONG');
    expect(accounts.byEmail(state.db, EMAIL)!.recoveryHash).toBe(hashRecoveryKey(recoveryKey));
  });

  it('with no race replaces the key', async () => {
    const account = makeAccount();
    await startSession(account.id);
    const res = await rotate();
    expect(res.status).toBe(200);
    const { recoveryKey } = (await res.json()) as { recoveryKey: string };
    expect(accounts.byId(state.db, account.id)!.recoveryHash).toBe(hashRecoveryKey(recoveryKey));
  });
});

describe('POST /api/account/recovery-key attempt limits', () => {
  it('after 10 correct rotations from one account is 429 and hashes nothing', async () => {
    enforceLimits();
    const account = makeAccount();
    await startSession(account.id);
    for (let i = 0; i < 10; i++) expect((await rotate()).status).toBe(200);
    hashes.verify.mockClear();
    const res = await rotate();
    expect(res.status).toBe(429);
    expect(hashes.verify).not.toHaveBeenCalled();
  });

  it('after 30 attempts from one address across accounts is 429 and hashes nothing', async () => {
    enforceLimits();
    for (let a = 0; a < 3; a++) {
      const account = makeAccount(`seller${a}@example.com`);
      await startSession(account.id);
      for (let i = 0; i < 10; i++) expect((await rotate()).status).toBe(200);
    }
    const account = makeAccount('late@example.com');
    await startSession(account.id);
    hashes.verify.mockClear();
    const res = await rotate();
    expect(res.status).toBe(429);
    expect(hashes.verify).not.toHaveBeenCalled();
    expect((await rotate(OLD_PASSWORD, '198.51.100.7')).status).toBe(200);
  });

  it('a missing password costs no attempt', async () => {
    enforceLimits();
    const account = makeAccount();
    await startSession(account.id);
    for (let i = 0; i < 15; i++) expect((await rotate('')).status).toBe(403);
    expect((await rotate()).status).toBe(200);
  });
});

describe('failure limits hold under a burst (SR11)', () => {
  it('login: 15 wrong guesses at once run 10 hashes, the rest are 429', async () => {
    enforceLimits();
    makeAccount();
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => login(`wrong guess number ${i} here`)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 401)).toHaveLength(10);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(hashes.verify).toHaveBeenCalledTimes(10);
  });

  it('login: an unknown email is limited the same way', async () => {
    enforceLimits();
    const results = await Promise.all(Array.from({ length: 15 }, () => login(OLD_PASSWORD, 'nobody@example.com')));
    expect(results.filter((r) => r.status === 401)).toHaveLength(10);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(hashes.dummy).toHaveBeenCalledTimes(10);
  });

  it('recovery: 10 wrong keys at once run 5 hashes, the rest are 429', async () => {
    enforceLimits();
    makeAccount();
    const results = await Promise.all(Array.from({ length: 10 }, () => recover('AAAAA-AAAAA-AAAAA-AAAAA')));
    expect(results.filter((r) => r.status === 401)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(hashes.hash).toHaveBeenCalledTimes(5);
  });

  it('current password: 15 wrong guesses at once run 10 hashes, the rest are 429', async () => {
    enforceLimits();
    const account = makeAccount();
    await startSession(account.id);
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => rotate(`wrong guess number ${i} here`)));
    expect(results.filter((r) => r.status === 403)).toHaveLength(10);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(hashes.verify).toHaveBeenCalledTimes(10);
  });
});

describe('what counts as a failure', () => {
  it('a successful login gives its reservation back', async () => {
    enforceLimits();
    makeAccount();
    for (let i = 0; i < 15; i++) expect((await login()).status).toBe(200);
  });

  it('a busy hash gate is not a guess', async () => {
    enforceLimits();
    makeAccount();
    hashes.verify.mockRejectedValue(new HashBusyError());
    for (let i = 0; i < 10; i++) expect((await login('a wrong sentence goes here')).status).toBe(503);
    hashes.verify.mockReset();
    hashes.verify.mockImplementation(async (p: string, stored: string) => stored === `fake$${p}`);
    expect((await login('a wrong sentence goes here')).status).toBe(401);
  });

  it('a busy hash gate is not a wrong recovery key', async () => {
    enforceLimits();
    makeAccount();
    hashes.hash.mockRejectedValueOnce(new HashBusyError());
    expect((await recover()).status).toBe(503);
    for (let i = 0; i < 4; i++) hashes.hash.mockRejectedValueOnce(new HashBusyError());
    for (let i = 0; i < 4; i++) expect((await recover()).status).toBe(503);
    expect((await recover()).status).toBe(200);
  });

  it('a weak new password is not a wrong recovery key', async () => {
    enforceLimits();
    makeAccount();
    const weak = () => recoverRoute(post('/api/auth/recover', { email: EMAIL, recoveryKey: KEY, newPassword: 'short' }));
    for (let i = 0; i < 5; i++) expect((await weak()).status).toBe(400);
    expect((await recover()).status).toBe(200);
  });

  it('a busy hash gate does not use up the current-password failures', async () => {
    enforceLimits();
    const account = makeAccount();
    await startSession(account.id);
    hashes.verify.mockRejectedValueOnce(new HashBusyError());
    expect((await rotate()).status).toBe(503);
    hashes.verify.mockClear();
    expect((await rotate('wrong sentence for this account')).status).toBe(403);
  });

  it('recovery still works after 10 login failures', async () => {
    enforceLimits();
    makeAccount();
    for (let i = 0; i < 10; i++) expect((await login('wrong sentence for this account')).status).toBe(401);
    expect((await login('wrong sentence for this account')).status).toBe(429);
    expect((await recover()).status).toBe(200);
  });
});
