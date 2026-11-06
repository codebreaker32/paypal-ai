// The buyer's view of an order (the receipt page and GET /api/orders/[ref]), read from SQLite only: the poller and the
// return URL do the PayPal sync.
import type { Db } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import { isDemoShop, maskEmail } from '@/lib/domain/payee';
import type { OrderStatus } from '@/lib/domain/types';
import { cancelledByShop, cardDeclined } from './declined';
import { lastCaptureFailure } from './service';
import { ORDER_REF, type ReceiptOrder } from './receipt-types';

export { OPEN_RECEIPT_STATUSES, ORDER_REF, paidToText, type PaidTo, type ReceiptLine, type ReceiptOrder } from './receipt-types';

/** Statuses where the money has left the buyer (or PayPal holds it): the receipt says whose account it went to. */
const PAID_OR_HELD: ReadonlySet<OrderStatus> = new Set(['paid', 'fulfilled', 'payment_pending']);

export function receiptView(db: Db, ref: string): ReceiptOrder | null {
  if (!ORDER_REF.test(ref)) return null;
  const order = ordersRepo.byId(db, ref);
  if (!order) return null;
  const shop = shopsRepo.byId(db, order.shopId);
  if (!shop) return null;
  const awaiting = order.status === 'awaiting_approval';
  const events = awaiting || order.status === 'cancelled' ? eventsRepo.list(db, order.id) : [];
  const declined = awaiting && cardDeclined(order, events);
  return {
    number: order.number,
    status: order.status,
    totalCents: order.totalCents,
    itemsCents: order.itemsCents,
    shippingCents: order.shippingCents,
    shopName: shop.name,
    shopSlug: shop.slug,
    fulfillment: order.fulfillment,
    approvalUrl: awaiting ? order.approvalUrl : null,
    paidAt: order.paidAt,
    declined,
    cancelledByShop: cancelledByShop(order, events),
    captureRefused: lastCaptureFailure(db, order) !== null,
    paidTo: PAID_OR_HELD.has(order.status)
      ? order.payeeEmail !== null
        ? { kind: 'seller', shopName: shop.name, maskedEmail: maskEmail(order.payeeEmail) }
        : { kind: 'platform', shopName: shop.name, demo: isDemoShop(shop) }
      : null,
    lines: order.lines.map((l) => ({ name: l.name, label: l.label, qty: l.qty, unitCents: l.unitCents })),
  };
}
