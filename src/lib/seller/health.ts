// "Can't reach PayPal" banner (spec §4 Dashboard). Seller pages only read SQLite, so this is inferred from what the
// order syncs left behind: a recent failed attempt to take a payment, or open orders nobody has checked lately
// (the 15 s poller isn't getting through).
import type { Db } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import type { Order } from '@/lib/domain/types';
import { POLL_WINDOW_MS } from '@/lib/orders/poller';
import { isOpen } from '@/lib/orders/state';

export const STALE_CHECK_MS = 2 * 60_000;
export const RECENT_ERROR_MS = 5 * 60_000;

export function paypalLooksUnreachable(db: Db, orders: Order[], nowMs: number = Date.now()): boolean {
  return orders.some((o) => {
    if (!isOpen(o.status) || (o.status === 'awaiting_approval' && Date.parse(o.expiresAt) <= nowMs)) return false;
    const age = nowMs - Date.parse(o.createdAt);
    const lastChecked = o.lastCheckedAt ? Date.parse(o.lastCheckedAt) : null;
    // The poller only re-checks orders younger than its window, so older ones are expected to go stale.
    const polled = age > STALE_CHECK_MS && age < POLL_WINDOW_MS;
    if (polled && (lastChecked === null || nowMs - lastChecked > STALE_CHECK_MS)) return true;
    return eventsRepo
      .list(db, o.id)
      .some((e) => e.type === 'capture_error' && nowMs - Date.parse(e.createdAt) < RECENT_ERROR_MS);
  });
}
