// The labelled fallback brief (no AI). Pure, so server pages and API routes can use it without the Agent Toolkit.
import { formatUSD } from '@/lib/domain/money';
import type { Order, OrderBrief } from '@/lib/domain/types';
import { lineName, whereLabel } from '@/lib/seller/view';

export const HEADLINE_MAX = 90;

/** A paid order with no brief after this long has lost its brief job (restart); show the template instead. */
export const BRIEF_STALE_MS = 2 * 60_000;

export function shorten(s: string, max = HEADLINE_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:·-]+$/, '')}…`;
}

function shipLabel(order: Order): string {
  const w = whereLabel(order);
  if (w === 'Shipping') return 'ship to buyer';
  return w.charAt(0).toLowerCase() + w.slice(1);
}

/** The labelled fallback: "{n} items · {total} · {pickup | ship to City, ST}", prep list from the lines, no flags. */
export function templateBrief(order: Order): OrderBrief {
  const n = order.lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    headline: shorten(`${n} item${n === 1 ? '' : 's'} · ${formatUSD(order.totalCents)} · ${shipLabel(order)}`),
    prep_list: order.lines.map((l) => ({ text: lineName(l), qty: l.qty })),
    buyer_requests: [],
    flags: [],
    next_action: order.fulfillment === 'shipping' ? 'ship' : 'prepare',
  };
}

/** Whether a paid order is still waiting for a brief that is not coming (paid long ago, nothing stored). */
export function briefIsStale(order: Order, nowMs = Date.now()): boolean {
  if ((order.status !== 'paid' && order.status !== 'fulfilled') || order.brief || !order.paidAt) return false;
  return nowMs - Date.parse(order.paidAt) > BRIEF_STALE_MS;
}

/** Display copy of the order: a stale brief-less paid order gets the template brief so "Writing the brief…" stops. */
export function withFallbackBrief(order: Order, nowMs = Date.now()): Order {
  return briefIsStale(order, nowMs) ? { ...order, brief: templateBrief(order), briefSource: 'template' } : order;
}
