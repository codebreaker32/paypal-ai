// Client-safe receipt types and constants (no database imports: the Receipt client component uses them).
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
