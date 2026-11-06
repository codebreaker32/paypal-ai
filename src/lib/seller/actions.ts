// Seller actions on a paid order (spec §4 Dashboard / Order detail, §8 Add tracking):
// Mark picked up (pickup orders) and Add tracking (shipping orders: sent to PayPal through the Agent Toolkit for a
// platform-paid order; saved in Shelfie only for an order paid into the seller's own PayPal account, spec §8a).
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import type { Order, Shop, Tracker } from '@/lib/domain/types';
import { markFulfilled, type OrderDeps } from '@/lib/orders/service';
import { InvalidTransition } from '@/lib/orders/state';
import { createSellerToolkit, ScopeError, ToolkitError, type ShopScope } from '@/lib/paypal/toolkit';
import { carrierLabel, type TrackingInput } from './carriers';
import { shopScope } from './scope';

export { CARRIERS, carrierLabel, parseTrackingInput, type CarrierId, type TrackingInput } from './carriers';

export class SellerActionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SellerActionError';
  }
}

// ---- helpers ----------------------------------------------------------------------------------------------------

function ownOrder(deps: Pick<OrderDeps, 'db'>, shop: Shop, orderId: string): Order {
  const order = ordersRepo.byId(deps.db, orderId);
  if (!order || order.shopId !== shop.id) throw new SellerActionError(404, 'ORDER_NOT_FOUND', 'No such order at this shop.');
  return order;
}

function requirePaid(order: Order): void {
  if (order.status === 'paid') return;
  if (order.status === 'fulfilled') {
    throw new SellerActionError(
      409,
      'ALREADY_FULFILLED',
      order.fulfillment === 'pickup' ? 'This order is already marked picked up.' : 'Tracking was already added to this order.',
    );
  }
  throw new SellerActionError(409, 'NOT_PAID', 'Payment for this order has not been received yet.');
}

// ---- Mark picked up -------------------------------------------------------------------------------------------------

export async function markPickedUp(deps: OrderDeps, shop: Shop, orderId: string): Promise<Order> {
  const order = ownOrder(deps, shop, orderId);
  if (order.fulfillment !== 'pickup') {
    throw new SellerActionError(409, 'SHIPPING_ORDER', 'This order ships. Add tracking instead.');
  }
  requirePaid(order);
  try {
    return await markFulfilled(deps, order.id, 'seller');
  } catch (e) {
    if (e instanceof InvalidTransition) requirePaid(ordersRepo.byId(deps.db, order.id)!);
    throw e;
  }
}

// ---- Add tracking -----------------------------------------------------------------------------------------------------

type SellerToolkit = ReturnType<typeof createSellerToolkit>;
export type TrackingToolkitFactory = (scope: ShopScope) => Pick<SellerToolkit, 'createShipmentTracking'>;

interface BatchResult {
  tracker_identifiers?: unknown[];
  errors?: { name?: string; message?: string; details?: { issue?: string; description?: string }[] }[];
}

function batchError(result: unknown): string | null {
  const r = (result ?? {}) as BatchResult;
  if (!Array.isArray(r.errors) || r.errors.length === 0) return null;
  if (Array.isArray(r.tracker_identifiers) && r.tracker_identifiers.length > 0) return null;
  const e = r.errors[0];
  return e.details?.[0]?.description ?? e.message ?? e.name ?? 'PayPal did not accept the tracking number.';
}

// One add-tracking at a time per order (in-process, on globalThis so every route bundle shares it): a double tap waits
// for the first request, then sees its result instead of sending a second tracker to PayPal.
const g = globalThis as unknown as { __shelfieTrackingLocks?: Map<string, Promise<void>> };
const trackingLocks = (): Map<string, Promise<void>> => (g.__shelfieTrackingLocks ??= new Map());

async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const locks = trackingLocks();
  const run = (locks.get(orderId) ?? Promise.resolve()).then(fn);
  const tail = run.then(
    () => {},
    () => {},
  );
  locks.set(orderId, tail);
  try {
    return await run;
  } finally {
    if (locks.get(orderId) === tail) locks.delete(orderId);
  }
}

export interface TrackingResult {
  order: Order;
  trackers: Tracker[];
  /**
   * Whether the tracker went to PayPal. False for an order paid into the seller's own account: PayPal refuses the
   * platform's tracker on a capture that belongs to the seller (NOT_AUTHORIZED, verified 6 Nov), so it is saved in
   * Shelfie only (the buyer's agent reads it through get_order_status) and the seller adds it in PayPal themselves.
   */
  atPayPal: boolean;
}

/**
 * Stores the tracker, marks the order fulfilled and logs `tracking_added`. For a platform-paid order (the demo shop)
 * the number goes to PayPal first (toolkit create_shipment_tracking on the order's capture); for a seller-paid order
 * (`payeeEmail` set) there is no PayPal call (see TrackingResult.atPayPal). Only for this shop's paid shipping orders.
 * Runs one at a time per order; if an earlier attempt stored this tracker but didn't mark the order fulfilled, a retry
 * finishes that without calling PayPal again.
 */
export async function addTracking(
  deps: OrderDeps & { toolkit?: TrackingToolkitFactory },
  shop: Shop,
  orderId: string,
  input: TrackingInput,
): Promise<TrackingResult> {
  return withOrderLock(orderId, () => addTrackingNow(deps, shop, orderId, input));
}

async function addTrackingNow(
  deps: OrderDeps & { toolkit?: TrackingToolkitFactory },
  shop: Shop,
  orderId: string,
  input: TrackingInput,
): Promise<TrackingResult> {
  const { db } = deps;
  const order = ownOrder(deps, shop, orderId);
  if (order.fulfillment !== 'shipping') {
    throw new SellerActionError(409, 'PICKUP_ORDER', 'This is a pickup order. Mark it picked up instead.');
  }
  requirePaid(order);
  const atPayPal = order.payeeEmail === null;
  const stored = ordersRepo.trackers(db, order.id).find((t) => t.trackingNumber === input.trackingNumber);
  if (stored) {
    // PayPal has it (if it goes there) and so do we, but the order is still paid: an earlier attempt failed after storing it.
    return finishTracking(deps, order.id, stored.carrier, input, atPayPal);
  }
  if (!atPayPal) {
    const carrier = carrierLabel(input);
    ordersRepo.addTracker(db, { orderId: order.id, carrier, trackingNumber: input.trackingNumber, paypalStatus: null });
    return finishTracking(deps, order.id, carrier, input, false);
  }

  let result: unknown;
  try {
    const toolkit = (deps.toolkit ?? createSellerToolkit)(shopScope(db, shop.id));
    result = await toolkit.createShipmentTracking({
      orderId: order.paypalOrderId,
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
    });
  } catch (e) {
    if (e instanceof ToolkitError) throw new SellerActionError(502, 'PAYPAL_REJECTED', `PayPal said: ${e.message}`);
    if (e instanceof ScopeError) throw new SellerActionError(404, 'ORDER_NOT_FOUND', 'No such order at this shop.');
    console.warn(`[shelfie] add tracking for ${order.number}: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    throw new SellerActionError(502, 'PAYPAL_UNAVAILABLE', "We couldn't reach PayPal. Check the number and try again in a moment.");
  }
  const rejected = batchError(result);
  if (rejected) throw new SellerActionError(502, 'PAYPAL_REJECTED', `PayPal said: ${rejected}`);

  const carrier = carrierLabel(input);
  ordersRepo.addTracker(db, { orderId: order.id, carrier, trackingNumber: input.trackingNumber, paypalStatus: 'SHIPPED' });
  return finishTracking(deps, order.id, carrier, input, true);
}

/** Marks the order fulfilled and logs `tracking_added`, once the tracker is stored (and at PayPal, when it goes there). */
async function finishTracking(
  deps: OrderDeps,
  orderId: string,
  carrier: string,
  input: TrackingInput,
  atPayPal: boolean,
): Promise<TrackingResult> {
  const { db } = deps;
  try {
    await markFulfilled(deps, orderId, 'seller');
  } catch (e) {
    // Someone fulfilled it a moment ago; the tracker is stored (and at PayPal) either way.
    if (!(e instanceof InvalidTransition)) throw e;
  }
  eventsRepo.add(db, orderId, 'tracking_added', 'seller', {
    carrier,
    paypalCarrier: input.carrier,
    trackingNumber: input.trackingNumber,
    atPayPal,
  });
  return { order: ordersRepo.byId(db, orderId)!, trackers: ordersRepo.trackers(db, orderId), atPayPal };
}
