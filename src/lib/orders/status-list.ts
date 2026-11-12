// The "Your orders" list's live statuses: for refs the browser already holds, the status word and nothing else
// (no names, emails, addresses or lines). The ref is the receipt page's bearer secret, so this exposes nothing new.
import type { Db } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';
import { ORDER_REF, RECEIPT_STATUS_LABEL, type OrderStatusEntry } from './receipt-types';

export const MAX_STATUS_REFS = 50;

/** Per address: the list page asks once per visit, so this is generous for people and tight for guessing. */
export const ORDER_STATUS_RATE = { limit: 60, windowMs: 60_000 } as const;

/** Splits `?refs=a,b`: trimmed, deduplicated. Null when any ref is malformed or there are none or too many. */
export function parseStatusRefs(raw: string | null): string[] | null {
  if (!raw) return null;
  const refs = [...new Set(raw.split(',').map((r) => r.trim()).filter(Boolean))];
  if (refs.length === 0 || refs.length > MAX_STATUS_REFS) return null;
  return refs.every((r) => ORDER_REF.test(r)) ? refs : null;
}

/** One entry per known ref, in the order asked; unknown refs are left out. */
export function orderStatuses(db: Db, refs: string[]): OrderStatusEntry[] {
  const out: OrderStatusEntry[] = [];
  for (const ref of refs) {
    const row = ordersRepo.byId(db, ref);
    if (row) out.push({ ref, status: row.status, statusLabel: RECEIPT_STATUS_LABEL[row.status] });
  }
  return out;
}
