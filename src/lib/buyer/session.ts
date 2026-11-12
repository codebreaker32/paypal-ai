// Buyer sessions ("Log in with PayPal" on /orders): the cookie holds 32 random bytes, the database their SHA-256 and the
// PayPal account's emails. 30 days, never extended. Completely separate from seller sessions (src/lib/auth/session.ts).
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getConfig } from '@/lib/config';
import { getDb, type Db } from '@/lib/db';
import * as buyerSessions from '@/lib/db/repos/buyer-sessions';
import { hashToken } from '@/lib/domain/ids';
import type { OrderStatus } from '@/lib/domain/types';
import { RECEIPT_STATUS_LABEL } from '@/lib/orders/receipt-types';

export const BUYER_COOKIE = 'shelfie_buyer';
export const BUYER_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const BUYER_ORDERS_MAX = 100;

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: 'lax', path: '/', secure: getConfig().appUrl.startsWith('https:'), maxAge }) as const;

/** Stores a new session for these emails and returns its raw token (for the cookie only; never log it). */
export function createBuyerSession(db: Db, emails: string[], nowMs: number = Date.now()): string {
  const token = randomBytes(32).toString('base64url');
  db.transaction(() => {
    buyerSessions.purgeExpired(db, new Date(nowMs).toISOString());
    buyerSessions.create(db, {
      tokenHash: hashToken(token),
      emails,
      expiresAt: new Date(nowMs + BUYER_SESSION_SECONDS * 1000).toISOString(),
    });
  })();
  return token;
}

/** The emails behind a token, or null when unknown or expired (an expired row is deleted). */
export function buyerEmailsOfToken(db: Db, token: string | undefined, nowMs: number = Date.now()): string[] | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = buyerSessions.byTokenHash(db, tokenHash);
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= nowMs) {
    buyerSessions.deleteByTokenHash(db, tokenHash);
    return null;
  }
  return row.emails.length > 0 ? row.emails : null;
}

/** This request's buyer emails, or null. With no cookie the database is not opened. */
export async function currentBuyerEmails(): Promise<string[] | null> {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  return token ? buyerEmailsOfToken(getDb(), token) : null;
}

/** Replaces this browser's buyer session with a new one for these emails. */
export async function startBuyerSession(emails: string[]): Promise<void> {
  const jar = await cookies();
  const db = getDb();
  const previous = jar.get(BUYER_COOKIE)?.value;
  if (previous) buyerSessions.deleteByTokenHash(db, hashToken(previous));
  jar.set(BUYER_COOKIE, createBuyerSession(db, emails), cookieOptions(BUYER_SESSION_SECONDS));
}

export async function endBuyerSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(BUYER_COOKIE)?.value;
  if (!token) return;
  buyerSessions.deleteByTokenHash(getDb(), hashToken(token));
  jar.set(BUYER_COOKIE, '', cookieOptions(0));
}

/** One row of `GET /api/buyer/orders`: the receipt ref and what the list shows, nothing personal. */
export interface BuyerOrderEntry {
  ref: string;
  shopName: string;
  total: number;
  createdAt: string;
  status: OrderStatus;
  statusLabel: string;
}

/** Orders whose PayPal payer email is one of these (already lower-cased), newest first, at most 100. */
export function listBuyerOrders(db: Db, emails: string[]): BuyerOrderEntry[] {
  if (emails.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT o.id AS ref, s.name AS shopName, o.total_cents AS total, o.created_at AS createdAt, o.status AS status
         FROM orders o JOIN shops s ON s.id = o.shop_id
        WHERE o.payer_email IS NOT NULL AND lower(trim(o.payer_email)) IN (${emails.map(() => '?').join(', ')})
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ${BUYER_ORDERS_MAX}`,
    )
    .all(...emails) as Omit<BuyerOrderEntry, 'statusLabel'>[];
  return rows.map((r) => ({
    ref: r.ref,
    shopName: r.shopName,
    total: r.total,
    createdAt: r.createdAt,
    status: r.status,
    statusLabel: RECEIPT_STATUS_LABEL[r.status],
  }));
}
