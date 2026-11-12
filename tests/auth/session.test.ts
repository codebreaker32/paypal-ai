// Server-side sessions and their cookies.
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

interface Written {
  value: string;
  options: Record<string, unknown>;
}

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  dbOpens: 0,
  jar: new Map<string, string>(),
  written: new Map<string, Written>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      state.written.set(name, { value, options });
      state.jar.set(name, value);
    },
  }),
}));
vi.mock('@/lib/db', async (orig) => ({
  ...(await orig<typeof import('@/lib/db')>()),
  getDb: () => {
    state.dbOpens++;
    return state.db;
  },
}));

const { createTestDb } = await import('@/lib/db');
const accounts = await import('@/lib/db/repos/accounts');
const sessions = await import('@/lib/db/repos/sessions');
const shops = await import('@/lib/db/repos/shops');
const { RETURNING_COOKIE, currentAccount, endSession, landingPath, requireAccount, sessionCookieName, startSession } = await import(
  '@/lib/auth/session'
);

const DAY_MS = 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const allSessions = () => state.db.prepare('SELECT * FROM sessions').all() as { token_hash: string; created_at: string; expires_at: string }[];

describe('sessions', () => {
  let accountId: string;

  beforeEach(() => {
    state.db = createTestDb();
    state.dbOpens = 0;
    state.jar.clear();
    state.written.clear();
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    accountId = accounts.create(state.db, {
      email: 'rosa@example.com', passwordHash: 'h', recoveryHash: 'r', termsVersion: 'v1',
    }).id;
  });

  afterEach(() => vi.unstubAllEnvs());

  describe('currentAccount', () => {
    it('with no cookie returns null without opening the database (the build has no disk)', async () => {
      expect(await currentAccount()).toBeNull();
      expect(state.dbOpens).toBe(0);
    });

    it('finds the account behind a valid cookie', async () => {
      await startSession(accountId);
      expect((await currentAccount())?.id).toBe(accountId);
    });

    it('is null for a token no session has', async () => {
      state.jar.set(sessionCookieName(), 'made-up-token');
      expect(await currentAccount()).toBeNull();
    });

    it('logs out a row past its expiry and removes it', async () => {
      state.jar.set(sessionCookieName(), 'expired');
      sessions.create(state.db, { tokenHash: sha256('expired'), accountId, expiresAt: new Date(Date.now() - 1).toISOString() });
      expect(await currentAccount()).toBeNull();
      expect(allSessions()).toEqual([]);
    });

    it('never extends a session: reading it leaves its expiry alone', async () => {
      await startSession(accountId);
      const before = allSessions()[0].expires_at;
      await currentAccount();
      expect(allSessions()[0].expires_at).toBe(before);
    });
  });

  describe('startSession', () => {
    it('puts 32 random bytes in the cookie and only their SHA-256 in the database', async () => {
      await startSession(accountId);
      const token = state.jar.get(sessionCookieName())!;
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(allSessions()).toHaveLength(1);
      expect(allSessions()[0].token_hash).toBe(sha256(token));
      expect(JSON.stringify(allSessions())).not.toContain(token);
    });

    it('expires 30 days after it was created', async () => {
      await startSession(accountId);
      const [row] = allSessions();
      const lifetime = Date.parse(row.expires_at) - Date.parse(row.created_at);
      expect(Math.abs(lifetime - 30 * DAY_MS)).toBeLessThan(5000);
    });

    it("replaces this browser's existing session and leaves the account's other devices logged in", async () => {
      sessions.create(state.db, { tokenHash: sha256('phone'), accountId, expiresAt: new Date(Date.now() + DAY_MS).toISOString() });
      await startSession(accountId);
      const first = state.jar.get(sessionCookieName())!;
      await startSession(accountId);
      expect(state.jar.get(sessionCookieName())).not.toBe(first);
      expect(sessions.byTokenHash(state.db, sha256(first))).toBeNull();
      expect(sessions.byTokenHash(state.db, sha256('phone'))).not.toBeNull();
      expect(allSessions()).toHaveLength(2);
    });

    it('purges expired rows', async () => {
      sessions.create(state.db, { tokenHash: 'stale', accountId, expiresAt: new Date(Date.now() - 1).toISOString() });
      await startSession(accountId);
      expect(sessions.byTokenHash(state.db, 'stale')).toBeNull();
    });
  });

  describe('endSession', () => {
    it('deletes the row and clears the session cookie, and keeps the returning cookie', async () => {
      await startSession(accountId);
      const token = state.jar.get(sessionCookieName())!;
      await endSession();
      expect(sessions.byTokenHash(state.db, sha256(token))).toBeNull();
      expect(state.written.get(sessionCookieName())).toMatchObject({ value: '', options: { maxAge: 0, path: '/' } });
      expect(state.jar.get(RETURNING_COOKIE)).toBe('1');
    });

    it('with no cookie does nothing to the database', async () => {
      await endSession();
      expect(state.dbOpens).toBe(0);
    });
  });

  describe('cookies', () => {
    it('on http: shelfie_session, httpOnly, lax, path /, not secure, 30 days', async () => {
      await startSession(accountId);
      expect(sessionCookieName()).toBe('shelfie_session');
      expect(state.written.get('shelfie_session')?.options).toEqual({
        httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 30 * 24 * 60 * 60,
      });
    });

    it('on https: __Host-shelfie_session, secure', async () => {
      vi.stubEnv('APP_URL', 'https://shelfie.example');
      await startSession(accountId);
      expect(sessionCookieName()).toBe('__Host-shelfie_session');
      expect(state.written.get('__Host-shelfie_session')?.options).toEqual({
        httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 30 * 24 * 60 * 60,
      });
    });

    it('clears a __Host- cookie with Secure and Path=/, or the browser ignores the clearing', async () => {
      vi.stubEnv('APP_URL', 'https://shelfie.example');
      await startSession(accountId);
      await endSession();
      expect(state.written.get('__Host-shelfie_session')).toMatchObject({
        value: '', options: { secure: true, path: '/', httpOnly: true, sameSite: 'lax', maxAge: 0 },
      });
    });

    it('sets shelfie_returning=1, httpOnly, for a year', async () => {
      await startSession(accountId);
      expect(RETURNING_COOKIE).toBe('shelfie_returning');
      expect(state.written.get('shelfie_returning')).toEqual({
        value: '1',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 365 * 24 * 60 * 60 },
      });
    });
  });

  describe('requireAccount', () => {
    it('returns the account when logged in', async () => {
      await startSession(accountId);
      expect((await requireAccount('/shops')).id).toBe(accountId);
    });

    it('otherwise redirects to /login with the path to come back to', async () => {
      await expect(requireAccount('/account')).rejects.toMatchObject({ digest: expect.stringContaining('/login?next=/account') });
    });

    it('with no path redirects to plain /login', async () => {
      await expect(requireAccount()).rejects.toMatchObject({ digest: expect.stringMatching(/;\/login;/) });
    });
  });

  describe('landingPath', () => {
    it('with no shops goes to add one', () => {
      expect(landingPath(accountId)).toBe('/shops/new');
    });

    it('with one live shop goes to its dashboard', () => {
      const { shop } = shops.create(state.db, { name: 'Marigold', accountId });
      shops.publish(state.db, shop.id);
      expect(landingPath(accountId)).toBe(`/shops/${shop.id}`);
    });

    it('with one draft goes to its setup', () => {
      const { shop } = shops.create(state.db, { name: 'Marigold', accountId });
      expect(landingPath(accountId)).toBe(`/shops/${shop.id}/setup`);
    });

    it('with several goes to the list', () => {
      shops.create(state.db, { name: 'One', accountId });
      shops.create(state.db, { name: 'Two', accountId });
      expect(landingPath(accountId)).toBe('/shops');
    });
  });
});
