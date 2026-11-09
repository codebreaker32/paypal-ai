// What the receipt says for each order state, and whether it keeps re-reading the order. Pure, so it is unit-tested.
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Loader2,
  PackageCheck,
  TimerOff,
  type LucideIcon,
} from 'lucide-react';
import { formatUSD } from '@/lib/domain/money';
import { OPEN_RECEIPT_STATUSES, type ReceiptOrder } from '@/lib/orders/receipt-types';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface StatusView {
  tone: Tone;
  icon: LucideIcon;
  spin?: boolean;
  title: string;
  body: string;
  /** Label of the PayPal button, when the buyer still has to approve. */
  approve?: string;
}

export interface Tracking {
  carrier: string;
  number: string;
}

/** While PayPal is still deciding, the receipt re-reads the order. A refused capture waits for the buyer, so it stops. */
export function keepsPolling(o: ReceiptOrder): boolean {
  return OPEN_RECEIPT_STATUSES.includes(o.status) && !(o.status === 'approved' && o.captureRefused);
}

export function statusView(o: ReceiptOrder, pickupNotes: string, tracking: Tracking | null): StatusView {
  const total = formatUSD(o.totalCents);
  const pickup = o.fulfillment === 'pickup';
  switch (o.status) {
    case 'awaiting_approval':
      return o.declined
        ? {
            tone: 'danger',
            icon: CircleAlert,
            title: 'PayPal declined that payment',
            body: 'Nothing was charged. Try PayPal again and pick another card or your PayPal balance.',
            approve: 'Try PayPal again',
          }
        : {
            tone: 'warn',
            icon: Clock,
            title: 'Waiting for your approval',
            body: `Approve the payment on PayPal to place this order. Nothing is charged until you do, and the link works for ${o.approvalMinutes ?? 60} minutes.`,
            approve: `Approve ${total} on PayPal`,
          };
    case 'approved':
      return o.captureRefused
        ? {
            tone: 'danger',
            icon: CircleAlert,
            title: "PayPal didn’t complete the payment",
            body: `You approved it, but PayPal refused to complete the payment, so nothing was charged. Contact ${o.shopName}, or place the order again later.`,
          }
        : {
            tone: 'info',
            icon: Loader2,
            spin: true,
            title: 'Confirming with PayPal…',
            body: "You approved the payment. We’re confirming it with PayPal, and this page updates by itself.",
          };
    case 'payment_pending':
      return {
        tone: 'info',
        icon: Hourglass,
        title: 'Confirming with PayPal…',
        body: `PayPal is still clearing this payment. This page updates by itself, and ${o.shopName} starts on your order once it clears.`,
      };
    case 'paid':
      return {
        tone: 'ok',
        icon: CircleCheck,
        title: `Paid. ${o.shopName} has your order.`,
        body: pickup
          ? pickupNotes
            ? `Pick it up: ${pickupNotes}`
            : `${o.shopName} will let you know when it’s ready to pick up.`
          : `${o.shopName} will ship it to the address you gave PayPal.`,
      };
    case 'fulfilled':
      return {
        tone: 'ok',
        icon: PackageCheck,
        title: `Paid. ${o.shopName} has your order.`,
        body: pickup ? 'Picked up. Enjoy!' : tracking ? `Shipped with ${tracking.carrier}, tracking number ${tracking.number}.` : 'Shipped.',
      };
    case 'cancelled':
      return { tone: 'neutral', icon: CircleX, title: 'Order cancelled', body: o.cancelledByShop ? 'This order was cancelled by the shop before payment, so nothing was charged.' : 'You cancelled on PayPal, so nothing was charged.' };
    case 'expired':
      return {
        tone: 'neutral',
        icon: TimerOff,
        title: 'This order expired',
        body: `It wasn’t approved on PayPal within ${o.approvalMinutes ?? 60} minutes, so nothing was charged. You can place it again.`,
      };
    case 'failed':
      return {
        tone: 'danger',
        icon: CircleAlert,
        title: "The payment didn’t go through",
        body: 'Nothing was charged. If you still want these items, place the order again.',
      };
  }
}
