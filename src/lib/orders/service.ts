// Order service: create (idempotent), sync with PayPal (capture claim), cancel, fulfil.
// advanceOrder() is the only writer of orders.status (compare-and-set, spec §7).
import { createHash } from 'node:crypto';
import type { Db } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as eventsRepo from '@/lib/db/repos/events';
import { newId, orderNumber } from '@/lib/domain/ids';
import { toPayPalValue } from '@/lib/domain/money';
import type { EventSource, Fulfillment, Order, OrderEvent, ShipTo, Shop } from '@/lib/domain/types';
import { PayPalApiError, type PayPalOrder, type PayPalPort } from '@/lib/paypal/types';
import { OrderError } from './errors';
import { priceOrder, shopLabel, type PriceLineInput, type PricedLine } from './pricing';
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
  /** The caller's rate-limit identity (client IP, or `console:<buyer ip>`), for the per-client unpaid-order cap. */
  clientKey?: string | null;
}

export const MAX_OPEN_ORDERS_PER_SHOP = 10;
/** One caller can hold at most this many unpaid orders per shop, so it cannot use up the shop-wide cap alone. */
export const MAX_OPEN_ORDERS_PER_CLIENT = 3;
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
 * Prices the order from the database, creates the PayPal order (PayPal-Request-Id `ord-<orderId>`, spec §8), stores
 * the snapshot. Idempotent per (shop, clientRequestId) through our database and an in-process in-flight map: a retry
 * returns the stored order and makes no PayPal call. The PayPal request id is deliberately per attempt, not per key:
 * if PayPal's response was lost, the retry gets a fresh PayPal order whose custom_id and return URL point at the row
 * we actually store (the orphaned first order is never approved and lapses). It also keeps the header ASCII whatever
 * characters the agent put in client_request_id.
 */
export async function createOrderForShop(deps: OrderDeps, shop: Shop, input: CreateOrderInput): Promise<Order> {
  const key = clean(input.clientRequestId, 64);
  if (!key) return createNew(deps, shop, input, null);
  const existing = ordersRepo.byClientRequestId(deps.db, shop.id, key);
  if (existing) return sameRequestOrConflict(existing, input);
  const slot = `${shop.id}\u0000${key}`;
  const pending = inflight.get(slot);
  if (pending) return pending.then((order) => sameRequestOrConflict(order, input));
  const p = createNew(deps, shop, input, key).finally(() => inflight.delete(slot));
  inflight.set(slot, p);
  return p;
}

/**
 * A client_request_id only makes a retry idempotent: the stored order comes back only when the request has the same
 * content (items, options, quantities, fulfillment). Anything else is a different order that reused the key, and gets
 * a conflict instead of someone else's order_ref and approval link.
 */
function sameRequestOrConflict(order: Order, input: CreateOrderInput): Order {
  const same =
    (input.fulfillment === undefined || input.fulfillment === order.fulfillment) &&
    input.lines.length === order.lines.length &&
    input.lines.every((l, i) => {
      const stored = order.lines[i];
      // An omitted option means the item's only option, which is what pricing stored.
      return stored.itemId === l.itemId && stored.qty === l.quantity && (l.optionId === undefined || stored.variantId === l.optionId);
    });
  if (same) return order;
  throw new OrderError(
    'IDEMPOTENCY_CONFLICT',
    'This client_request_id was already used for a different order. Use a new one.',
    'Send a new, unique client_request_id for this order. Reuse a client_request_id only to retry the exact same request.',
  );
}

async function createNew(deps: OrderDeps, shop: Shop, input: CreateOrderInput, key: string | null): Promise<Order> {
  const { db } = deps;
  const nowMs = clock(deps);
  const priced = priceOrder(db, shop, input.lines, input.fulfillment);
  const clientKey = input.clientKey ? createHash('sha256').update(input.clientKey).digest('hex').slice(0, 32) : null;
  // Reserve the slot before the PayPal await so concurrent calls can't all pass the count; the insert re-checks
  // the database count in the same transaction (another process may have inserted meanwhile).
  checkOpenCaps(db, shop, clientKey, true);
  const release = reserveOpenSlot(shop.id, clientKey);
  try {
    return await createReserved(deps, shop, input, key, priced, clientKey, nowMs);
  } finally {
    release();
  }
}

/** In-process reservations: create calls that passed the open-order caps and are waiting on PayPal. */
const reservedOpen = new Map<string, number>();
const shopSlot = (shopId: string) => `shop\u0000${shopId}`;
const clientSlot = (shopId: string, clientKey: string) => `client\u0000${shopId}\u0000${clientKey}`;

function reserveOpenSlot(shopId: string, clientKey: string | null): () => void {
  const slots = clientKey ? [shopSlot(shopId), clientSlot(shopId, clientKey)] : [shopSlot(shopId)];
  for (const s of slots) reservedOpen.set(s, (reservedOpen.get(s) ?? 0) + 1);
  return () => {
    for (const s of slots) {
      const n = (reservedOpen.get(s) ?? 1) - 1;
      if (n > 0) reservedOpen.set(s, n);
      else reservedOpen.delete(s);
    }
  };
}

/** Throws TOO_MANY_OPEN_ORDERS when the caller or the shop is at its unpaid-order cap (counting reservations if asked). */
function checkOpenCaps(db: Db, shop: Shop, clientKey: string | null, withReserved: boolean): void {
  const reserved = (slot: string) => (withReserved ? reservedOpen.get(slot) ?? 0 : 0);
  if (clientKey && ordersRepo.countOpenForClient(db, shop.id, clientKey) + reserved(clientSlot(shop.id, clientKey)) >= MAX_OPEN_ORDERS_PER_CLIENT) {
    throw new OrderError(
      'TOO_MANY_OPEN_ORDERS',
      `You already have ${MAX_OPEN_ORDERS_PER_CLIENT} orders waiting for payment at ${shopLabel(shop)}.`,
      'Ask the user to pay for an order they already started (share its approval_url again), or wait: unpaid orders expire after 60 minutes.',
      { max_open_orders_per_client: MAX_OPEN_ORDERS_PER_CLIENT },
    );
  }
  if (ordersRepo.countOpen(db, shop.id) + reserved(shopSlot(shop.id)) >= MAX_OPEN_ORDERS_PER_SHOP) {
    throw new OrderError(
      'TOO_MANY_OPEN_ORDERS',
      `${shopLabel(shop)} already has ${MAX_OPEN_ORDERS_PER_SHOP} orders waiting for payment.`,
      'Ask the user to pay or cancel an order they already started, or try again later. Unpaid orders expire after 60 minutes.',
      { max_open_orders: MAX_OPEN_ORDERS_PER_SHOP },
    );
  }
}

async function createReserved(
  deps: OrderDeps,
  shop: Shop,
  input: CreateOrderInput,
  key: string | null,
  priced: ReturnType<typeof priceOrder>,
  clientKey: string | null,
  nowMs: number,
): Promise<Order> {
  const { db } = deps;
  const next = transition(null, 'created');
  if ('ignored' in next || next.next !== 'awaiting_approval') throw new Error('state table: created must start awaiting_approval');

  const id = newId('ord');
  const number = orderNumber();
  const requestId = `ord-${id}`;
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
    throw paypalUnavailable(e, 'create order');
  }

  const agentName = clean(input.agentName, 60);
  let order: Order;
  try {
    // Count and insert atomically. In this process our reservation guarantees room; this catches other processes.
    order = db.transaction(() => {
      checkOpenCaps(db, shop, clientKey, false);
      return ordersRepo.insert(
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
          clientKey,
          itemsCents: priced.itemsCents,
          shippingCents: priced.shippingCents,
          totalCents: priced.totalCents,
          paypalOrderId: created.id,
          approvalUrl: created.approveUrl,
          expiresAt: iso(nowMs + APPROVAL_WINDOW_MS),
        },
        priced.lines,
      );
    }).immediate();
  } catch (e) {
    // Lost a cross-process race on UNIQUE(shop_id, client_request_id) or on the PayPal order id: return the winner.
    if (isUniqueViolation(e)) {
      const byKey = key ? ordersRepo.byClientRequestId(db, shop.id, key) : null;
      if (byKey) return sameRequestOrConflict(byKey, input);
      const winner = ordersRepo.byPayPalId(db, created.id);
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
 * not approved after 60 minutes → expired. Settled orders are returned as they are: no PayPal call, no write.
 */
export async function syncOrder(deps: OrderDeps, orderId: string, source: EventSource): Promise<Order> {
  const { db } = deps;
  const order = ordersRepo.byId(db, orderId);
  if (!order) throw orderNotFound(orderId);
  if (!isOpen(order.status)) return order;
  const nowMs = clock(deps);
  try {
    let pp: PayPalOrder | null;
    try {
      pp = await deps.paypal.getOrder(order.paypalOrderId);
    } catch (e) {
      // PayPal drops orders that were never approved; treat a 404 as "not approved".
      if (e instanceof PayPalApiError && e.status === 404) pp = null;
      else throw paypalUnavailable(e, 'get order');
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
  const declines = countEvents(db, order.id, 'capture_declined');
  if (order.status === 'awaiting_approval' && declines > 0 && (source === 'poller' || source === 'mcp')) {
    // After a declined capture PayPal still says APPROVED until the buyer picks another funding source.
    // Only the buyer coming back (return URL) or PayPal's webhook triggers another capture, so the poller can't loop.
    return expireIfDue(db, order, source, nowMs, 'APPROVED');
  }
  if (order.status === 'approved' && (source === 'poller' || source === 'mcp') && lastCaptureFailure(db, order)) {
    // PayPal refused this capture for a non-transient reason; repeating it every poll won't help. Only the buyer
    // coming back (return URL) or a PayPal webhook tries again.
    return order;
  }
  if (order.status === 'awaiting_approval') {
    order = advanceOrder(db, order, 'paypal_approved', source, { detail: { paypalStatus: 'APPROVED' } }).order;
    if (order.status !== 'approved') return order;
  }

  const mismatch = findMismatch(order, pp);
  if (mismatch) return advanceOrder(db, order, 'mismatch', source, { detail: mismatch }).order;

  if (!ordersRepo.claimCapture(db, order.id, nowMs)) return order; // another caller holds the capture claim

  const paypalId = order.paypalOrderId;
  // First attempt: `cap-<paypalOrderId>` (spec §8). After a declined or refused capture PayPal may replay its cached
  // answer for a reused request id, so each later attempt gets `-N`. Transient errors keep the same id (idempotent retry).
  const refused = declines + countEvents(db, order.id, 'capture_failed');
  const requestId = refused > 0 ? `cap-${paypalId}-${refused}` : `cap-${paypalId}`;
  let captured: PayPalOrder;
  try {
    captured = await deps.paypal.captureOrder(paypalId, requestId);
  } catch (e) {
    if (e instanceof PayPalApiError && e.issue === 'ORDER_ALREADY_CAPTURED') {
      let fresh: PayPalOrder;
      try {
        fresh = await deps.paypal.getOrder(paypalId);
      } catch (err) {
        throw paypalUnavailable(err, 'get order');
      }
      return settle(deps, order, fresh, source, nowMs, { reconciled: 'ORDER_ALREADY_CAPTURED' });
    }
    if (e instanceof PayPalApiError && e.status === 422 && (e.issue === 'INSTRUMENT_DECLINED' || e.issue === 'ORDER_NOT_APPROVED')) {
      // The buyer's funding source was declined (or PayPal says the order isn't approved): the buyer can approve
      // again with the same link, so the order goes back to waiting for approval.
      return advanceOrder(db, order, 'capture_declined', source, {
        patch: { captureClaimedAt: null },
        detail: { issue: e.issue, debugId: e.debugId },
      }).order;
    }
    if (isTransient(e)) {
      // Network, 429 or 5xx: keep the claim; the next sync after 30 s retries with the same PayPal-Request-Id.
      eventsRepo.add(db, order.id, 'capture_error', source, {
        status: e instanceof PayPalApiError ? e.status : null,
        issue: e instanceof PayPalApiError ? e.issue : null,
      });
      throw paypalUnavailable(e, 'capture');
    }
    // Any other 4xx (incl. other 422 issues): not transient. Release the claim, record it, leave the order approved.
    const err = e as PayPalApiError;
    logPayPalRefusal('capture', err);
    ordersRepo.update(db, order.id, { captureClaimedAt: null });
    eventsRepo.add(db, order.id, 'capture_failed', source, { status: err.status, issue: err.issue ?? err.errorName, debugId: err.debugId });
    return ordersRepo.byId(db, order.id)!;
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
  // DECLINED / FAILED / anything else on an order PayPal already completed: final (coordinator ruling). Going back to
  // awaiting_approval here would loop, because the next GET shows COMPLETED again. Only a 422 INSTRUMENT_DECLINED on
  // our capture call sends the buyer back to approve.
  if (order.status === 'approved' || order.status === 'payment_pending') {
    return advanceOrder(db, order, 'capture_denied', source, { patch: { captureClaimedAt: null }, detail }).order;
  }
  return order;
}

/**
 * The PayPal refusal behind an `approved` order whose capture PayPal rejected for a non-transient reason, or null.
 * Used to stop automatic retries and to explain the state to the agent.
 */
export function lastCaptureFailure(db: Db, order: Order): { status: number | null; issue: string | null; debugId: string | null } | null {
  if (order.status !== 'approved') return null;
  const last = eventsRepo
    .list(db, order.id)
    .filter((e) => e.type === 'capture_failed' || e.type === 'capture_error' || e.type === 'paypal_approved')
    .at(-1);
  return last?.type === 'capture_failed' ? (last.detail as { status: number | null; issue: string | null; debugId: string | null }) : null;
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

function countEvents(db: Db, orderId: string, type: 'capture_declined' | 'capture_failed'): number {
  return eventsRepo.list(db, orderId).filter((e) => e.type === type && !(e.detail as { ignored?: boolean } | null)?.ignored).length;
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

/** Network errors, 429 and 5xx: worth retrying. Every other PayPal error is a refusal. */
function isTransient(e: unknown): boolean {
  return !(e instanceof PayPalApiError) || e.status >= 500 || e.status === 429;
}

/** Server-side record of a PayPal refusal: status, PayPal's names and debug id only (never request data or credentials). */
function logPayPalRefusal(op: string, e: PayPalApiError): void {
  console.error(
    `[shelfie] PayPal refused ${op}: HTTP ${e.status} ${e.errorName}` +
      `${e.issue ? ` issue=${e.issue}` : ''}${e.debugId ? ` debug_id=${e.debugId}` : ''}`,
  );
}

/**
 * Maps a PayPal failure to PAYPAL_UNAVAILABLE. Network, 429 and 5xx: retryable, "could not be reached". Any other
 * 4xx: logged with PayPal's debug id and reported as a refusal, not retryable.
 */
export function paypalUnavailable(e: unknown, op: string): OrderError {
  if (e instanceof OrderError) return e;
  if (!isTransient(e)) {
    const err = e as PayPalApiError;
    logPayPalRefusal(op, err);
    return new OrderError(
      'PAYPAL_UNAVAILABLE',
      `PayPal returned an error (${err.issue ?? err.errorName}).`,
      'PayPal refused this request, so retrying it will not help. Tell the user, and suggest trying again later or contacting the shop.',
      { paypal_issue: err.issue ?? err.errorName, debug_id: err.debugId },
      false,
    );
  }
  console.warn(`[shelfie] PayPal unavailable during ${op}: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
  return new OrderError(
    'PAYPAL_UNAVAILABLE',
    'PayPal could not be reached.',
    'Wait a few seconds and try again. Reusing the same client_request_id is safe: it never creates a second order.',
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
