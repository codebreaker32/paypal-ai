// Who owns a shop. An account-owned shop belongs to its account's session and nothing else (SR15). An unattached shop
// (the seed, the test harness) belongs to whoever holds its owner token: one httpOnly cookie per shop holds the raw
// token and the database stores only its SHA-256 hash.
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDb, type Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import type { Shop } from '@/lib/domain/types';
import { loginPath } from './next-path';
import { RETURNING_COOKIE, accountIdOfSession, currentAccount, sessionCookieName } from './session';

export const OWNER_COOKIE_PREFIX = 'shelfie_owner_';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const ownerCookieName = (shopId: string) => `${OWNER_COOKIE_PREFIX}${shopId}`;

/** The shop if this browser owns it, else null. */
export async function getOwnedShop(shopId: string): Promise<Shop | null> {
  const db = getDb();
  const shop = shops.byId(db, shopId);
  if (!shop) return null;
  if (shop.accountId) {
    const account = await currentAccount();
    return account?.id === shop.accountId ? shop : null;
  }
  const jar = await cookies();
  return shops.verifyOwnerToken(db, shopId, jar.get(ownerCookieName(shopId))?.value) ? shop : null;
}

/**
 * For a handler that writes after waiting on a request body: read this request's cookies before the wait, then run the
 * returned check inside the write's transaction, because a session can end while the body is still arriving.
 */
export async function ownershipCheck(shopId: string): Promise<(db: Db, shop: Shop) => boolean> {
  const jar = await cookies();
  const sessionToken = jar.get(sessionCookieName())?.value;
  const ownerToken = jar.get(ownerCookieName(shopId))?.value;
  return (db, shop) =>
    shop.accountId
      ? sessionToken !== undefined && accountIdOfSession(db, sessionToken) === shop.accountId
      : shops.verifyOwnerToken(db, shop.id, ownerToken);
}

/**
 * For pages: the shop if this browser owns it. A browser that has logged in before and has no valid session now goes
 * to log in and come back; anyone else gets a 404, so a shop's address tells a stranger nothing.
 */
export async function requireOwner(shopId: string): Promise<Shop> {
  const shop = await getOwnedShop(shopId);
  if (shop) return shop;
  const jar = await cookies();
  if (jar.get(RETURNING_COOKIE) && !(await currentAccount())) redirect(loginPath(`/shops/${shopId}`));
  notFound();
}

/** Call from a route handler or server action. */
export async function setOwnerCookie(shopId: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(ownerCookieName(shopId), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
}

/** Unattached shops this browser holds an owner cookie for (for "Open your dashboard" on the start page). */
export async function listOwnedShops(): Promise<Shop[]> {
  const jar = await cookies();
  const db = getDb();
  return jar
    .getAll()
    .filter((c) => c.name.startsWith(OWNER_COOKIE_PREFIX))
    .map((c) => {
      const shopId = c.name.slice(OWNER_COOKIE_PREFIX.length);
      return shops.verifyOwnerToken(db, shopId, c.value) ? shops.byId(db, shopId) : null;
    })
    .filter((s): s is Shop => s !== null && s.accountId === null);
}
