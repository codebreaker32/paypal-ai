// Client-safe receipt types and constants (no database imports: the receipt's client component uses them).
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
  /** The shop cancelled it before payment (not the buyer on PayPal). */
  cancelledByShop: boolean;
  /**
   * The buyer approved, but PayPal refused to complete the payment for a reason retrying won't fix. Nothing was
   * charged; automatic retries have stopped (only the buyer coming back from PayPal, or a webhook, tries again).
   */
  captureRefused: boolean;
  /** Who the payment went to, once paid or held by PayPal (spec §8a). The email is only ever masked here. */
  paidTo: PaidTo | null;
  lines: ReceiptLine[];
}

/** The shop's own PayPal account (masked email), or, for the demo shop with no PayPal email, Shelfie's demo account. */
export type PaidTo = { kind: 'seller'; shopName: string; maskedEmail: string } | { kind: 'platform'; shopName: string };

/** "Paid to Marigold Bakehouse’s own PayPal account (r•••@example.com)" / "Paid to Shelfie’s demo PayPal account for …". */
export function paidToText(p: PaidTo): string {
  return p.kind === 'seller'
    ? `Paid to ${p.shopName}’s own PayPal account (${p.maskedEmail})`
    : `Paid to Shelfie’s demo PayPal account for ${p.shopName}`;
}

/** Statuses the receipt keeps polling for. */
export const OPEN_RECEIPT_STATUSES: readonly OrderStatus[] = ['awaiting_approval', 'approved', 'payment_pending'];

/** Order references look like `ord_` + lowercase letters and digits; anything else is never looked up or put in a URL. */
export const ORDER_REF = /^ord_[a-z0-9]{1,64}$/;
