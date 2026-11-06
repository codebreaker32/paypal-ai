// Which orders a dashboard poll just saw get paid. Pure, so the "no toast on first load" rule is unit-tested.
import type { Order } from '@/lib/domain/types';

/** Paid or past it: an order in either state was already the seller's to prepare. */
const PAID_OR_LATER = new Set<Order['status']>(['paid', 'fulfilled']);

/**
 * Orders that are paid in `next` and were absent or not yet paid in `prev`, in `next`'s order. The first poll after
 * load passes `prev` = the orders the page rendered with, so an order already paid at load never counts.
 */
export function newlyPaid(prev: Order[], next: Order[]): Order[] {
  const before = new Map(prev.map((o) => [o.id, o.status]));
  return next.filter((o) => {
    if (o.status !== 'paid') return false;
    const was = before.get(o.id);
    return was === undefined || !PAID_OR_LATER.has(was);
  });
}
