// Plain-word views of orders for the seller dashboard and order detail. Pure: safe in client components.
import type { Order, OrderEventRow, OrderLine } from '@/lib/domain/types';

export interface OrderGroups {
  /** Paid: the seller has something to do. */
  toPrepare: Order[];
  /** The buyer hasn't finished paying yet. */
  waiting: Order[];
  /** Handed over, or never paid. */
  done: Order[];
}

export function groupOrders(orders: Order[]): OrderGroups {
  const g: OrderGroups = { toPrepare: [], waiting: [], done: [] };
  for (const o of orders) {
    if (o.status === 'paid') g.toPrepare.push(o);
    else if (o.status === 'awaiting_approval' || o.status === 'approved' || o.status === 'payment_pending') g.waiting.push(o);
    else g.done.push(o);
  }
  return g;
}

/** The money in a group, for its header ("Paid $43.50", "Not paid yet $83.00"). */
export function groupTotalCents(orders: Pick<Order, 'totalCents'>[]): number {
  return orders.reduce((sum, o) => sum + o.totalCents, 0);
}

export const lineName = (l: Pick<OrderLine, 'name' | 'label'>) => (l.label ? `${l.name} (${l.label})` : l.name);

export function itemSummary(lines: OrderLine[]): string {
  return lines.map((l) => `${l.qty} × ${lineName(l)}`).join(', ');
}

export function whereLabel(order: Pick<Order, 'fulfillment' | 'shipTo'>): string {
  if (order.fulfillment === 'pickup') return 'Pickup';
  const city = order.shipTo?.city?.trim();
  const state = order.shipTo?.state?.trim();
  return city ? `Ship to ${state ? `${city}, ${state}` : city}` : 'Shipping';
}

export function buyerLabel(order: Pick<Order, 'payerName' | 'buyerName'>): string {
  return order.payerName?.trim() || order.buyerName?.trim() || 'No name given';
}

/** "shelfie-assistant" → "Shelfie Assistant"; names that already have capitals are kept as written. */
export function agentLabel(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return 'an AI assistant';
  if (/[A-Z]/.test(n)) return n;
  return n
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export interface TimelineEntry {
  id: string;
  text: string;
  at: string;
  tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
}

/** PayPal's reason for holding a payment to an email no PayPal account uses yet (verified in the sandbox, 6 Nov). */
export const UNILATERAL = 'UNILATERAL';

const heldWords = (email: string | null) => `PayPal is holding this payment: no PayPal account uses ${email ?? 'your PayPal email'} yet`;

/**
 * A payment_pending order that PayPal holds because its payee email has no PayPal account yet (a typo, or the seller
 * hasn't signed up): the latest capture_pending event carries PayPal's reason UNILATERAL.
 */
export function heldForUnknownEmail(order: Pick<Order, 'status'>, events: OrderEventRow[]): boolean {
  if (order.status !== 'payment_pending') return false;
  const last = events.filter((e) => e.type === 'capture_pending' && !(e.detail as { ignored?: boolean } | null)?.ignored).at(-1);
  return (last?.detail as { pendingReason?: unknown } | null)?.pendingReason === UNILATERAL;
}

/**
 * The order page's PayPal card: the account this order paid (the email it was created with; owner only) and where to
 * find the payment. No payee: Shelfie's account, called the demo's only for the demo shop (`isDemo`); another shop's
 * order without one dates from before it had a PayPal email.
 */
export function paypalCardWords(order: Pick<Order, 'payeeEmail'>, isDemo: boolean): { paidTo: string; note: string } {
  if (order.payeeEmail !== null) return { paidTo: order.payeeEmail, note: 'Search these in that PayPal account to find the payment.' };
  return isDemo
    ? { paidTo: 'Shelfie’s demo PayPal account', note: 'This demo shop is paid to Shelfie’s own sandbox account, so the payment is there, not in yours.' }
    : {
        paidTo: 'Shelfie’s PayPal account',
        note: 'This order was placed before your shop had a PayPal email, so the payment is in Shelfie’s account, not yours.',
      };
}

/** Order events as plain words. Repeated (ignored) events, sync bookkeeping and unknown types are left out. */
export function timelineEntries(events: OrderEventRow[], order: Pick<Order, 'fulfillment' | 'agentName' | 'payeeEmail'>): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const e of events) {
    const d = (e.detail ?? {}) as Record<string, unknown>;
    if (d.ignored) continue;
    const entry = (text: string, tone: TimelineEntry['tone'] = 'neutral') => out.push({ id: e.id, text, at: e.createdAt, tone });
    switch (e.type) {
      case 'created':
        entry(`Order created by ${agentLabel((d.agentName as string | null | undefined) ?? order.agentName)}`);
        break;
      case 'paypal_approved':
        entry('Approved on PayPal');
        break;
      case 'capture_completed':
        entry('Payment received', 'ok');
        break;
      case 'capture_pending':
        entry(d.pendingReason === UNILATERAL ? heldWords(order.payeeEmail) : 'Payment pending at PayPal', 'warn');
        break;
      case 'capture_declined':
        entry('Payment declined; the buyer can try again on PayPal', 'warn');
        break;
      case 'capture_denied':
        entry('Payment denied by PayPal', 'danger');
        break;
      case 'capture_failed':
        entry('PayPal refused the payment, so nothing was charged. Don’t hand over or ship this order.', 'danger');
        break;
      case 'capture_refused':
        entry('Payment failed: PayPal refused it and the order is now closed', 'danger');
        break;
      case 'capture_error':
        entry("Couldn’t reach PayPal to take the payment; trying again", 'warn');
        break;
      case 'mismatch':
        entry(
          d.payeeMatches === false
            ? 'Stopped: PayPal would have paid a different PayPal account, so nothing was charged'
            : "Stopped: PayPal’s amount didn’t match this order",
          'danger',
        );
        break;
      case 'cancelled':
        entry(
          e.source === 'seller'
            ? 'Cancelled by the shop before payment'
            : d.paypalStatus === 'VOIDED'
              ? 'PayPal voided the order before payment'
              : 'Cancelled on PayPal by the buyer',
        );
        break;
      case 'expired':
        entry('Expired: not approved within 60 minutes');
        break;
      case 'fulfilled':
        entry(order.fulfillment === 'pickup' ? 'Marked picked up' : 'Marked shipped', 'info');
        break;
      case 'tracking_added':
        // Saved: a seller-paid order's tracker stays in Shelfie (PayPal refuses it from the platform, spec §8a).
        entry(`${d.atPayPal === false ? 'Tracking saved' : 'Tracking added'}: ${String(d.carrier ?? '')} ${String(d.trackingNumber ?? '')}`.trim(), 'info');
        break;
      default:
        break;
    }
  }
  return out;
}

/** Declined card and shop-cancelled: the same rules as the receipt and get_order_status. */
export { cancelledByShop, cardDeclined } from '@/lib/orders/declined';

/**
 * Title and text of the order detail's action card for an order the seller can't act on yet (or any more). `held`:
 * PayPal holds the payment because no PayPal account uses the order's email (heldForUnknownEmail).
 */
export function actionWords(
  order: Pick<Order, 'status' | 'captureRefused'> & { payeeEmail?: string | null },
  declined = false,
  byShop = false,
  held = false,
): [string, string] {
  if (order.status === 'payment_pending' && held) {
    return [
      'PayPal is holding this payment',
      // The title already says PayPal is holding it; the text says why and what to do.
      `No PayPal account uses ${order.payeeEmail ?? 'your PayPal email'} yet. If that’s your email, sign up for PayPal with it to receive the money. ` +
        'If it has a typo, correct it in Settings so new orders reach you. Don’t hand over or ship until it shows Paid.',
    ];
  }
  if (order.status === 'cancelled' && byShop) return ['Cancelled', 'The shop cancelled it before the buyer paid. Nothing was charged.'];
  if (order.status === 'awaiting_approval' && declined) {
    return ['Card declined', 'PayPal declined the buyer’s card. They can pick another on PayPal. Nothing to prepare until it shows Paid.'];
  }
  if (order.status === 'approved' && order.captureRefused) {
    return [
      'PayPal refused the payment',
      'The buyer approved on PayPal, but PayPal refused to complete the payment, so nothing was charged. Don’t hand over or ship this order.',
    ];
  }
  const words: Record<Exclude<Order['status'], 'paid' | 'fulfilled'>, [string, string]> = {
    awaiting_approval: ['Waiting for the buyer', "They haven’t approved the payment on PayPal yet. Nothing to prepare until they do."],
    approved: ['Taking the payment', 'The buyer approved on PayPal. The payment should land in a few seconds.'],
    payment_pending: ['Payment pending', "PayPal is still clearing this payment. Don’t hand over or ship until it shows Paid."],
    failed: ['Payment failed', "Nothing was charged. Don’t hand over or ship this order."],
    cancelled: ['Cancelled', 'The buyer cancelled on PayPal. Nothing was charged.'],
    expired: ['Expired', 'The buyer didn\'t approve within 60 minutes, so the order expired. Nothing was charged.'],
  };
  return order.status === 'paid' || order.status === 'fulfilled' ? ['', ''] : words[order.status];
}

/**
 * Folds a polled list into what the dashboard shows. A poll that started before a local action (Mark picked up)
 * can come back with the old state: never move a fulfilled order back to paid.
 */
export function mergePolledOrders(current: Order[], polled: Order[]): Order[] {
  const byId = new Map(current.map((o) => [o.id, o]));
  return polled.map((o) => {
    const mine = byId.get(o.id);
    return mine && mine.status === 'fulfilled' && o.status === 'paid' ? mine : o;
  });
}
