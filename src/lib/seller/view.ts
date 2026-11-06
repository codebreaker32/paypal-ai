// Plain-word views of orders for the seller dashboard and order detail. Pure: safe in client components.
import type { Order, OrderEventRow, OrderLine } from '@/lib/domain/types';

export interface OrderGroups {
  /** Paid: the seller has something to do. */
  toPrepare: Order[];
  /** The buyer hasn’t finished paying yet. */
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
  return order.payerName?.trim() || order.buyerName?.trim() || 'Buyer';
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

/** Order events as plain words. Repeated (ignored) events, sync bookkeeping and unknown types are left out. */
export function timelineEntries(events: OrderEventRow[], order: Pick<Order, 'fulfillment' | 'agentName'>): TimelineEntry[] {
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
        entry('Payment pending at PayPal', 'warn');
        break;
      case 'capture_declined':
        entry('Payment declined; the buyer can try again on PayPal', 'warn');
        break;
      case 'capture_denied':
        entry('Payment denied by PayPal', 'danger');
        break;
      case 'capture_error':
        entry("Couldn’t reach PayPal to take the payment; trying again", 'warn');
        break;
      case 'mismatch':
        entry("Stopped: PayPal’s amount didn’t match this order", 'danger');
        break;
      case 'cancelled':
        entry('Cancelled on PayPal by the buyer');
        break;
      case 'expired':
        entry('Expired: not approved within 60 minutes');
        break;
      case 'fulfilled':
        entry(order.fulfillment === 'pickup' ? 'Marked picked up' : 'Marked shipped', 'info');
        break;
      case 'tracking_added':
        entry(`Tracking added: ${String(d.carrier ?? '')} ${String(d.trackingNumber ?? '')}`.trim(), 'info');
        break;
      default:
        break;
    }
  }
  return out;
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
