// The buyer's view of an order, read from SQLite only (the poller and the return URL do the PayPal sync).
import type { Db } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import type { Fulfillment, OrderStatus } from '@/lib/domain/types';

export interface ReceiptLine {
  name: string;
  label: string | null;
  qty: number;
  unitCents: number;
}

/** `GET /api/orders/[ref]` → `{ order: ReceiptOrder }` (wave-2 contract, plus itemsCents, shippingCents and declined). */
export interface ReceiptOrder {
  number: string;
  status: OrderStatus;
  totalCents: number;
  itemsCents: number;
  shippingCents: number;
  shopName: string;
  shopSlug: string;
  fulfillment: Fulfillment;
  /** Only while the order waits for the buyer's approval on PayPal. */
  approvalUrl: string | null;
  paidAt: string | null;
  /** PayPal declined the payment method; the buyer can approve again with the same link. */
  declined: boolean;
  lines: ReceiptLine[];
}

/** Statuses the receipt keeps polling for. */
export const OPEN_RECEIPT_STATUSES: readonly OrderStatus[] = ['awaiting_approval', 'approved', 'payment_pending'];

/** Order references look like `ord_` + lowercase letters and digits; anything else is never looked up or put in a URL. */
export const ORDER_REF = /^ord_[a-z0-9]{1,64}$/;

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
    lines: order.lines.map((l) => ({ name: l.name, label: l.label, qty: l.qty, unitCents: l.unitCents })),
  };
}
