// The buyer's view of an order, read from SQLite only (the poller and the return URL do the PayPal sync).
import type { Db } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import { lastCaptureFailure } from '@/lib/orders/service';
import { ORDER_REF, type ReceiptOrder } from './receipt-types';

export { OPEN_RECEIPT_STATUSES, ORDER_REF, type ReceiptLine, type ReceiptOrder } from './receipt-types';

export function receiptView(db: Db, ref: string): ReceiptOrder | null {
  if (!ORDER_REF.test(ref)) return null;
  const order = ordersRepo.byId(db, ref);
  if (!order) return null;
  const shop = shopsRepo.byId(db, order.shopId);
  if (!shop) return null;
  const awaiting = order.status === 'awaiting_approval';
  const declined =
    awaiting &&
    eventsRepo
      .list(db, order.id)
      .some((e) => e.type === 'capture_declined' && !(e.detail as { ignored?: boolean } | null)?.ignored);
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
    captureRefused: lastCaptureFailure(db, order) !== null,
    lines: order.lines.map((l) => ({ name: l.name, label: l.label, qty: l.qty, unitCents: l.unitCents })),
  };
}
