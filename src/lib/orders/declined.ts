// The "card declined" rule shared by the buyer's receipt, the seller's order detail and get_order_status.
// Pure (type imports only), so the seller views can use it in client components.
import type { Order, OrderEventRow } from '@/lib/domain/types';

/** PayPal declined the card the buyer approved with, and the order is back to waiting for them to pick another. */
export function cardDeclined(order: Pick<Order, 'status'>, events: OrderEventRow[]): boolean {
  return (
    order.status === 'awaiting_approval' &&
    events.some((e) => e.type === 'capture_declined' && !(e.detail as { ignored?: boolean } | null)?.ignored)
  );
}

/** The shop cancelled this order before payment (a `seller` cancel event), rather than the buyer on PayPal. */
export function cancelledByShop(order: Pick<Order, 'status'>, events: OrderEventRow[]): boolean {
  return (
    order.status === 'cancelled' &&
    events.some((e) => e.type === 'cancelled' && e.source === 'seller' && !(e.detail as { ignored?: boolean } | null)?.ignored)
  );
}
