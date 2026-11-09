// Server-side sessions: the cookie holds 32 random bytes, the database their SHA-256 (SR13). 30 days, never extended.
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { getDb, now, type Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as sessions from '@/lib/db/repos/sessions';
import * as shops from '@/lib/db/repos/shops';
import { hashToken } from '@/lib/domain/ids';
import { loginPath } from './next-path';

const DAY_SECONDS = 24 * 60 * 60;
const SESSION_SECONDS = 30 * DAY_SECONDS;
const RETURNING_SECONDS = 365 * DAY_SECONDS;

/** Set at login and kept through logout: this browser has had an account, so a shop link shows the login page, not a 404. */
export const RETURNING_COOKIE = 'shelfie_returning';

const isHttps = (): boolean => getConfig().appUrl.startsWith('https:');

/** SR14: the `__Host-` prefix needs Secure, so it is only used on https. */
export const sessionCookieName = (): string => (isHttps() ? '__Host-shelfie_session' : 'shelfie_session');

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: 'lax', path: '/', secure: isHttps(), maxAge }) as const;

/**
 * The account behind this request's cookie, or null. With no cookie the database is not opened: a page rendered at
 * build time has no disk.
 */
export async function currentAccount(): Promise<accounts.Account | null> {
  return (await currentSession())?.account ?? null;
}

/**
 * `currentAccount` with the raw token, for a handler that writes after a wait: `accountIdOfSession(db, token)` inside the
 * write's transaction tells it the session outlived the wait. The token stays in server memory; never log or return it.
 */
export async function currentSession(): Promise<{ account: accounts.Account; token: string } | null> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token) return null;
  const db = getDb();
  const accountId = accountIdOfSession(db, token);
  const account = accountId ? accounts.byId(db, accountId) : null;
  return account ? { account, token } : null;
}

/** Whose session this token is right now, or null. Synchronous, so a write can ask inside its own transaction. */
export function accountIdOfSession(db: Db, token: string): string | null {
  const tokenHash = hashToken(token);
  const session = sessions.byTokenHash(db, tokenHash);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.deleteByTokenHash(db, tokenHash);
    return null;
  }
  return session.accountId;
}

/** For `/shops`, `/account` and the like: the account, or a redirect to log in and come back to `next`. */
export async function requireAccount(next?: string): Promise<accounts.Account> {
  const account = await currentAccount();
  if (!account) redirect(loginPath(next));
  return account;
}

/**
 * Call from a route handler after checking credentials. Replaces this browser's own session and purges expired rows;
 * the account's other devices stay logged in.
 */
export async function startSession(accountId: string): Promise<void> {
  await openSession(accountId, () => true);
}

/**
 * `startSession` for a login: the row must still hold the hash that was just verified, checked in the same transaction
 * as the insert. False, and no session, when a recovery swapped the password during the hash.
 */
export function startSessionIfPasswordUnchanged(accountId: string, verifiedHash: string): Promise<boolean> {
  return openSession(accountId, (db) => accounts.byId(db, accountId)?.passwordHash === verifiedHash);
}

async function openSession(accountId: string, stillValid: (db: Db) => boolean): Promise<boolean> {
  const jar = await cookies();
  const db = getDb();
  const previous = jar.get(sessionCookieName())?.value;
  const token = randomBytes(32).toString('base64url');
  const opened = db.transaction(() => {
    if (!stillValid(db)) return false;
    if (previous) sessions.deleteByTokenHash(db, hashToken(previous));
    sessions.purgeExpired(db, now());
    sessions.create(db, {
      tokenHash: hashToken(token),
      accountId,
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
    });
    return true;
  })();
  if (!opened) return false;
  jar.set(sessionCookieName(), token, cookieOptions(SESSION_SECONDS));
  jar.set(RETURNING_COOKIE, '1', cookieOptions(RETURNING_SECONDS));
  return true;
}

/** Ends this browser's session. The cookie is cleared with its full attributes: a `__Host-` cookie needs them. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token) return;
  sessions.deleteByTokenHash(getDb(), hashToken(token));
  jar.set(sessionCookieName(), '', cookieOptions(0));
}

/** Where a logged-in seller belongs: no shops, add one; one shop, its dashboard (setup if a draft); more, the list. */
export function landingPath(accountId: string, db: Db = getDb()): string {
  const owned = shops.listByAccount(db, accountId);
  if (owned.length === 0) return '/shops/new';
  if (owned.length > 1) return '/shops';
  const [shop] = owned;
  return shop.status === 'draft' ? `/shops/${shop.id}/setup` : `/shops/${shop.id}`;
}
