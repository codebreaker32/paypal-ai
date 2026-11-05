// Order service: create (idempotent), sync with PayPal (capture claim), cancel, fulfil.
// advanceOrder() is the only writer of orders.status (compare-and-set, spec §7).
import type { Db } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as eventsRepo from '@/lib/db/repos/events';
import { newId, orderNumber } from '@/lib/domain/ids';
import { toPayPalValue } from '@/lib/domain/money';
import type { EventSource, Fulfillment, Order, OrderEvent, ShipTo, Shop } from '@/lib/domain/types';
import { PayPalApiError, type PayPalOrder, type PayPalPort } from '@/lib/paypal/types';
import { OrderError } from './errors';
import { priceOrder, type PriceLineInput, type PricedLine } from './pricing';
import { InvalidTransition, isOpen, transition, type OrderEffect } from './state';

export type OrderDeps = {
  db: Db;
  paypal: PayPalPort;
  appUrl: string;
  now?: () => number;
  onPaid?: (order: Order) => void | Promise<void>;
};

export interface CreateOrderInput {
  lines: PriceLineInput[];
  fulfillment?: Fulfillment;
  buyerName?: string | null;
  buyerNote?: string | null;
  agentName?: string | null;
  clientRequestId?: string | null;
}

export const MAX_OPEN_ORDERS_PER_SHOP = 10;
export const APPROVAL_WINDOW_MS = 60 * 60_000;

const clock = (deps: Pick<OrderDeps, 'now'>) => deps.now?.() ?? Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

// ---- state writes -------------------------------------------------------------------------------

export interface AdvanceResult {
  order: Order;
  /** True only for the caller whose compare-and-set moved the order. */
  changed: boolean;
  effects: OrderEffect[];
}

/**
 * Applies `event` to the order: pure transition, then compare-and-set on the current status, then an event row.
 * Repeated events are logged (detail.ignored) and change nothing. Throws InvalidTransition for forbidden pairs.
 * A caller that loses the compare-and-set gets the fresh order back with `changed: false`.
 */
export function advanceOrder(
  db: Db,
  order: Order,
  event: OrderEvent,
  source: EventSource,
  opts: { patch?: ordersRepo.OrderPatch; detail?: Record<string, unknown> } = {},
): AdvanceResult {
  const t = transition(order.status, event);
  if ('ignored' in t) {
    eventsRepo.add(db, order.id, event, source, { ...opts.detail, ignored: true, status: order.status });
    return { order, changed: false, effects: [] };
  }
  const won = ordersRepo.casStatus(db, order.id, order.status, t.next, opts.patch);
  const fresh = ordersRepo.byId(db, order.id)!;
  if (!won) return { order: fresh, changed: false, effects: [] };
  eventsRepo.add(db, order.id, event, source, opts.detail);
  return { order: fresh, changed: true, effects: t.effects };
}

// ---- create ---------------------------------------------------------------------------------------

/** In-process de-duplication of concurrent retries that carry the same client_request_id. */
const inflight = new Map<string, Promise<Order>>();

/**
 * Prices the order from the database, creates the PayPal order (PayPal-Request-Id `ord-…`), stores the snapshot.
 * Idempotent per (shop, clientRequestId): a retry returns the existing order and makes no PayPal call.
 */
export async function createOrderForShop(deps: OrderDeps, shop: Shop, input: CreateOrderInput): Promise<Order> {
  const key = clean(input.clientRequestId, 64);
  if (!key) return createNew(deps, shop, input, null);
  const existing = ordersRepo.byClientRequestId(deps.db, shop.id, key);
  if (existing) return existing;
  const slot = `${shop.id}\u0000${key}`;
  const pending = inflight.get(slot);
  if (pending) return pending;
  const p = createNew(deps, shop, input, key).finally(() => inflight.delete(slot));
  inflight.set(slot, p);
  return p;
}

async function createNew(deps: OrderDeps, shop: Shop, input: CreateOrderInput, key: string | null): Promise<Order> {
  const { db } = deps;
  const nowMs = clock(deps);
  const priced = priceOrder(db, shop, input.lines, input.fulfillment);
  if (ordersRepo.countOpen(db, shop.id) >= MAX_OPEN_ORDERS_PER_SHOP) {
    throw new OrderError(
      'TOO_MANY_OPEN_ORDERS',
      `${shop.name} already has ${MAX_OPEN_ORDERS_PER_SHOP} orders waiting for payment.`,
      'Ask the user to pay or cancel an order they already started, or try again later. Unpaid orders expire after 60 minutes.',
      { max_open_orders: MAX_OPEN_ORDERS_PER_SHOP },
    );
  }
  const next = transition(null, 'created');
  if ('ignored' in next || next.next !== 'awaiting_approval') throw new Error('state table: created must start awaiting_approval');

  const id = newId('ord');
  const number = orderNumber();
  const requestId = key ? `ord-${shop.id}-${key}` : `ord-${id}`;
  let created: Awaited<ReturnType<PayPalPort['createOrder']>>;
  try {
    created = await deps.paypal.createOrder(
      {
        shopName: shop.name,
        orderId: id,
        orderNumber: number,
        items: priced.lines.map((l) => ({ name: paypalItemName(l), unitCents: l.unitCents, qty: l.qty, sku: l.paypalProductId, kind: l.kind })),
        shippingCents: priced.shippingCents,
        fulfillment: priced.fulfillment,
        returnUrl: `${deps.appUrl}/api/paypal/return?o=${id}`,
        cancelUrl: `${deps.appUrl}/api/paypal/cancel?o=${id}`,
      },
      requestId,
    );
  } catch (e) {
    throw paypalUnavailable(e);
  }

  const agentName = clean(input.agentName, 60);
  let order: Order;
  try {
    order = ordersRepo.insert(
      db,
      {
        id,
        number,
        shopId: shop.id,
        fulfillment: priced.fulfillment,
        buyerName: clean(input.buyerName, 60),
        buyerNote: clean(input.buyerNote, 280, true),
        agentName,
        clientRequestId: key,
        itemsCents: priced.itemsCents,
        shippingCents: priced.shippingCents,
        totalCents: priced.totalCents,
        paypalOrderId: created.id,
        approvalUrl: created.approveUrl,
        expiresAt: iso(nowMs + APPROVAL_WINDOW_MS),
      },
      priced.lines,
    );
  } catch (e) {
    // Lost a cross-process race on UNIQUE(shop_id, client_request_id) or on the PayPal order id: return the winner.
    if (isUniqueViolation(e)) {
      const winner = (key && ordersRepo.byClientRequestId(db, shop.id, key)) || ordersRepo.byPayPalId(db, created.id);
      if (winner) return winner;
    }
    throw e;
  }
  eventsRepo.add(db, order.id, 'created', 'mcp', {
    paypalOrderId: created.id,
    totalCents: order.totalCents,
    agentName,
    clientRequestId: key,
  });
  return order;
}

function paypalItemName(l: PricedLine): string {
  return (l.label ? `${l.name} (${l.label})` : l.name).slice(0, 127);
}

// ---- sync -----------------------------------------------------------------------------------------

/**
 * Reads the order from PayPal and moves ours forward: APPROVED → claim → capture; COMPLETED → reconcile;
 * not approved after 60 minutes → expired. Settled orders are not re-read (the call is logged and ignored).
 */
export async function syncOrder(deps: OrderDeps, orderId: string, source: EventSource): Promise<Order> {
  const { db } = deps;
  const order = ordersRepo.byId(db, orderId);
  if (!order) throw orderNotFound(orderId);
  if (!isOpen(order.status)) {
    eventsRepo.add(db, order.id, 'sync', source, { ignored: true, status: order.status });
    return order;
  }
  const nowMs = clock(deps);
  try {
    let pp: PayPalOrder | null;
    try {
      pp = await deps.paypal.getOrder(order.paypalOrderId);
    } catch (e) {
      // PayPal drops orders that were never approved; treat a 404 as "not approved".
      if (e instanceof PayPalApiError && e.status === 404) pp = null;
      else throw paypalUnavailable(e);
    }
    await reconcile(deps, order, pp, source, nowMs);
  } finally {
    ordersRepo.update(db, orderId, { lastCheckedAt: iso(nowMs) });
  }
  return ordersRepo.byId(db, orderId)!;
}

async function reconcile(deps: OrderDeps, order: Order, pp: PayPalOrder | null, source: EventSource, nowMs: number): Promise<Order> {
  switch (pp?.status) {
    case 'APPROVED':
      return approveAndCapture(deps, order, pp, source, nowMs);
    case 'COMPLETED':
      return settle(deps, order, pp, source, nowMs, {});
    case 'VOIDED':
      return order.status === 'awaiting_approval'
        ? advanceOrder(deps.db, order, 'cancelled', source, { detail: { paypalStatus: 'VOIDED' } }).order
        : order;
    default:
      return expireIfDue(deps.db, order, source, nowMs, pp?.status ?? 'NOT_FOUND');
  }
}

function expireIfDue(db: Db, order: Order, source: EventSource, nowMs: number, paypalStatus: string): Order {
  if (order.status !== 'awaiting_approval' || nowMs < Date.parse(order.expiresAt)) return order;
  return advanceOrder(db, order, 'expired', source, { detail: { paypalStatus } }).order;
}

async function approveAndCapture(deps: OrderDeps, order: Order, pp: PayPalOrder, source: EventSource, nowMs: number): Promise<Order> {
  const { db } = deps;
  if (order.status !== 'awaiting_approval' && order.status !== 'approved') return order;
  const declines = declineCount(db, order.id);
  if (order.status === 'awaiting_approval' && declines > 0 && (source === 'poller' || source === 'mcp')) {
    // After a declined capture PayPal still says APPROVED until the buyer picks another funding source.
    // Only the buyer coming back (return URL) or PayPal's webhook triggers another capture, so the poller can't loop.
    return expireIfDue(db, order, source, nowMs, 'APPROVED');
  }
  if (order.status === 'awaiting_approval') {
    order = advanceOrder(db, order, 'paypal_approved', source, { detail: { paypalStatus: 'APPROVED' } }).order;
    if (order.status !== 'approved') return order;
  }

  const mismatch = findMismatch(order, pp);
  if (mismatch) return advanceOrder(db, order, 'mismatch', source, { detail: mismatch }).order;

  if (!ordersRepo.claimCapture(db, order.id, nowMs)) return order; // another caller holds the capture claim

  const paypalId = order.paypalOrderId;
  const requestId = declines > 0 ? `cap-${paypalId}-${declines}` : `cap-${paypalId}`;
  let captured: PayPalOrder;
  try {
    captured = await deps.paypal.captureOrder(paypalId, requestId);
  } catch (e) {
    if (e instanceof PayPalApiError && e.issue === 'ORDER_ALREADY_CAPTURED') {
      let fresh: PayPalOrder;
      try {
        fresh = await deps.paypal.getOrder(paypalId);
      } catch (err) {
        throw paypalUnavailable(err);
      }
      return settle(deps, order, fresh, source, nowMs, { reconciled: 'ORDER_ALREADY_CAPTURED' });
    }
    if (e instanceof PayPalApiError && e.status === 422) {
      // INSTRUMENT_DECLINED, ORDER_NOT_APPROVED and other buyer-side refusals: the buyer can re-approve with the same link.
      return advanceOrder(db, order, 'capture_declined', source, {
        patch: { captureClaimedAt: null },
        detail: { issue: e.issue ?? e.errorName, debugId: e.debugId },
      }).order;
    }
    // Network or 5xx: keep the claim; the next sync after 30 s retries with the same PayPal-Request-Id.
    eventsRepo.add(db, order.id, 'capture_error', source, {
      status: e instanceof PayPalApiError ? e.status : null,
      issue: e instanceof PayPalApiError ? e.issue : null,
    });
    throw paypalUnavailable(e);
  }
  return settle(deps, order, captured, source, nowMs, {});
}

/** Applies a PayPal order whose capture already happened (or is pending/denied). */
function settle(deps: OrderDeps, order: Order, pp: PayPalOrder, source: EventSource, nowMs: number, extra: Record<string, unknown>): Order {
  const { db } = deps;
  if (order.status === 'awaiting_approval') {
    // PayPal moved on without us seeing APPROVED (e.g. captured by an earlier attempt).
    order = advanceOrder(db, order, 'paypal_approved', source, { detail: { paypalStatus: pp.status } }).order;
  }
  const cap = pp.purchase_units[0]?.payments?.captures?.[0];
  if (!cap) return order;
  const detail = { captureId: cap.id, captureStatus: cap.status, ...extra };

  if (cap.status === 'COMPLETED') {
    if (order.status !== 'approved' && order.status !== 'payment_pending') return order;
    const r = advanceOrder(db, order, 'capture_completed', source, {
      patch: { ...payerPatch(pp), captureId: cap.id, paidAt: iso(nowMs) },
      detail,
    });
    if (r.effects.includes('brief')) runOnPaid(deps, r.order);
    return r.order;
  }
  if (cap.status === 'PENDING') {
    if (order.status !== 'approved') return order;
    return advanceOrder(db, order, 'capture_pending', source, { patch: { ...payerPatch(pp), captureId: cap.id }, detail }).order;
  }
  // DECLINED / FAILED / anything else.
  if (order.status === 'payment_pending') return advanceOrder(db, order, 'capture_denied', source, { detail }).order;
  if (order.status === 'approved') {
    return advanceOrder(db, order, 'capture_declined', source, { patch: { captureClaimedAt: null }, detail }).order;
  }
  return order;
}

function findMismatch(order: Order, pp: PayPalOrder): Record<string, unknown> | null {
  const unit = pp.purchase_units[0];
  const expectedAmount = toPayPalValue(order.totalCents);
  const paypalAmount = unit?.amount?.value ?? null;
  const paypalCurrency = unit?.amount?.currency_code ?? null;
  const paypalCustomId = unit?.custom_id ?? null;
  if (paypalAmount === expectedAmount && paypalCurrency === 'USD' && paypalCustomId === order.id) return null;
  return { paypalAmount, expectedAmount, paypalCurrency, paypalCustomId };
}

function payerPatch(pp: PayPalOrder): Pick<ordersRepo.OrderPatch, 'payerName' | 'payerEmail' | 'shipTo'> {
  const n = pp.payer?.name;
  const payerName = [n?.given_name, n?.surname].filter(Boolean).join(' ').trim();
  const ship = pp.purchase_units[0]?.shipping;
  const a = ship?.address;
  const shipTo: ShipTo | undefined = ship
    ? {
        name: ship.name?.full_name ?? null,
        line1: a?.address_line_1 ?? null,
        line2: a?.address_line_2 ?? null,
        city: a?.admin_area_2 ?? null,
        state: a?.admin_area_1 ?? null,
        postalCode: a?.postal_code ?? null,
        countryCode: a?.country_code ?? null,
      }
    : undefined;
  return { payerName: payerName || undefined, payerEmail: pp.payer?.email_address ?? undefined, shipTo };
}

function declineCount(db: Db, orderId: string): number {
  return eventsRepo.list(db, orderId).filter((e) => e.type === 'capture_declined' && !(e.detail as { ignored?: boolean } | null)?.ignored).length;
}

/** Effect `brief`: never lets the hook fail the sync (it may call Claude and PayPal). */
function runOnPaid(deps: OrderDeps, order: Order): void {
  if (!deps.onPaid) return;
  const warn = (e: unknown) => console.warn(`[shelfie] onPaid failed for order ${order.number}: ${e instanceof Error ? e.message : String(e)}`);
  try {
    const r = deps.onPaid(order);
    if (r && typeof (r as Promise<void>).then === 'function') (r as Promise<void>).catch(warn);
  } catch (e) {
    warn(e);
  }
}

// ---- seller / buyer actions -----------------------------------------------------------------------

/** Buyer backed out on PayPal (cancel URL). Only an order still waiting for approval is cancelled. */
export async function cancelOrder(deps: OrderDeps, orderId: string): Promise<Order> {
  const order = ordersRepo.byId(deps.db, orderId);
  if (!order) throw orderNotFound(orderId);
  try {
    return advanceOrder(deps.db, order, 'cancelled', 'cancel_url').order;
  } catch (e) {
    if (!(e instanceof InvalidTransition)) throw e;
    eventsRepo.add(deps.db, order.id, 'cancelled', 'cancel_url', { ignored: true, status: order.status });
    return order;
  }
}

/** Seller handed the order over (pickup) or shipped it. Throws InvalidTransition unless the order is paid. */
export async function markFulfilled(deps: OrderDeps, orderId: string, source: 'seller'): Promise<Order> {
  const order = ordersRepo.byId(deps.db, orderId);
  if (!order) throw orderNotFound(orderId);
  return advanceOrder(deps.db, order, 'fulfilled', source, { patch: { fulfilledAt: iso(clock(deps)) } }).order;
}

// ---- helpers ----------------------------------------------------------------------------------------

function orderNotFound(orderId: string): OrderError {
  return new OrderError('ORDER_NOT_FOUND', `No order with reference "${orderId.slice(0, 64)}".`, 'Use the order_ref returned by create_order.');
}

/** Maps a PayPal failure to PAYPAL_UNAVAILABLE: retryable for network, 429 and 5xx; not for other 4xx. */
export function paypalUnavailable(e: unknown): OrderError {
  if (e instanceof OrderError) return e;
  if (e instanceof PayPalApiError && e.status < 500 && e.status !== 429) {
    return new OrderError(
      'PAYPAL_UNAVAILABLE',
      `PayPal turned the request down (${e.issue ?? e.errorName}).`,
      'Tell the user PayPal could not set up this payment right now. Retrying the same request will not help.',
      { paypal_issue: e.issue ?? e.errorName, debug_id: e.debugId },
      false,
    );
  }
  console.warn(`[shelfie] PayPal unavailable: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
  return new OrderError(
    'PAYPAL_UNAVAILABLE',
    'PayPal could not be reached.',
    'Wait a few seconds and try again (for create_order, reuse the same client_request_id).',
    undefined,
    true,
  );
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE';
}

// C0/C1 control characters (keeps \n and \t only when multiline).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const CONTROL_AND_NEWLINES = /[\u0000-\u001F\u007F-\u009F]/g;

function clean(s: string | null | undefined, max: number, multiline = false): string | null {
  if (s === null || s === undefined) return null;
  const out = (multiline ? s.replace(CONTROL, '') : s.replace(CONTROL_AND_NEWLINES, ' ')).trim().slice(0, max);
  return out || null;
}
