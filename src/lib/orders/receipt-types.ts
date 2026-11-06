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
  /** Who the payment went to, once paid (spec §8a). The email is only ever masked here. */
  paidTo: PaidTo | null;
  /** While PayPal still holds the payment (payment_pending): whose account it is going to. Not paid yet, so not paidTo. */
  goingTo: PaidTo | null;
  lines: ReceiptLine[];
}

/**
 * The shop's own PayPal account (masked email), or Shelfie's account for an order with no payee: the demo shop's
 * (`demo`), or another shop's order from before it had a PayPal email.
 */
export type PaidTo =
  | { kind: 'seller'; shopName: string; maskedEmail: string }
  | { kind: 'platform'; shopName: string; demo: boolean };

/** "Marigold Bakehouse’s own PayPal account (r•••@example.com)" / "Shelfie’s demo PayPal account for Marigold Bakehouse". */
function accountText(p: PaidTo): string {
  if (p.kind === 'seller') return `${p.shopName}’s own PayPal account (${p.maskedEmail})`;
  return `Shelfie’s ${p.demo ? 'demo ' : ''}PayPal account for ${p.shopName}`;
}

/**
 * "Paid to Marigold Bakehouse’s own PayPal account (r•••@example.com)" / "Paid to Shelfie’s demo PayPal account for …"
 * (the demo shop) / "Paid to Shelfie’s PayPal account for …" (another shop's order from before it had an email).
 */
export function paidToText(p: PaidTo): string {
  return `Paid to ${accountText(p)}`;
}

/** A payment PayPal still holds: "Going to Marigold Bakehouse’s own PayPal account (r•••@…). PayPal is still confirming it." */
export function goingToText(p: PaidTo): string {
  return `Going to ${accountText(p)}. PayPal is still confirming it.`;
}

/** Statuses the receipt keeps polling for. */
export const OPEN_RECEIPT_STATUSES: readonly OrderStatus[] = ['awaiting_approval', 'approved', 'payment_pending'];

/** Order references look like `ord_` + lowercase letters and digits; anything else is never looked up or put in a URL. */
export const ORDER_REF = /^ord_[a-z0-9]{1,64}$/;
