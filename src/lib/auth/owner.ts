// Seller auth without accounts (spec §11): one httpOnly cookie per shop holds the raw owner token;
// the database stores only its SHA-256 hash.
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import type { Shop } from '@/lib/domain/types';

export const OWNER_COOKIE_PREFIX = 'shelfie_owner_';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const ownerCookieName = (shopId: string) => `${OWNER_COOKIE_PREFIX}${shopId}`;

/** The shop if this browser owns it, else null. */
export async function getOwnedShop(shopId: string): Promise<Shop | null> {
  const jar = await cookies();
  const token = jar.get(ownerCookieName(shopId))?.value;
  const db = getDb();
  return shops.verifyOwnerToken(db, shopId, token) ? shops.byId(db, shopId) : null;
}

/** For pages and route handlers: 404 unless this browser owns the shop. */
export async function requireOwner(shopId: string): Promise<Shop> {
  const shop = await getOwnedShop(shopId);
  if (!shop) notFound();
  return shop;
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

/** Shops this browser owns (for "Open your dashboard" on the start page). */
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
    .filter((s): s is Shop => s !== null);
}
