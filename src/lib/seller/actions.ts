// Seller actions on a paid order (spec §4 Dashboard / Order detail, §8 Add tracking):
// Mark picked up (pickup orders) and Add tracking (shipping orders, sent to PayPal through the Agent Toolkit).
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

/**
 * Sends the tracking number to PayPal (toolkit create_shipment_tracking on the order's capture), stores the tracker,
 * marks the order fulfilled and logs `tracking_added`. Only for this shop's paid shipping orders.
 */
export async function addTracking(
  deps: OrderDeps & { toolkit?: TrackingToolkitFactory },
  shop: Shop,
  orderId: string,
  input: TrackingInput,
): Promise<{ order: Order; trackers: Tracker[] }> {
  const { db } = deps;
  const order = ownOrder(deps, shop, orderId);
  if (order.fulfillment !== 'shipping') {
    throw new SellerActionError(409, 'PICKUP_ORDER', 'This is a pickup order. Mark it picked up instead.');
  }
  requirePaid(order);
  if (ordersRepo.trackers(db, order.id).some((t) => t.trackingNumber === input.trackingNumber)) {
    throw new SellerActionError(409, 'DUPLICATE_TRACKING', 'This tracking number is already on the order.');
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
  try {
    await markFulfilled(deps, order.id, 'seller');
  } catch (e) {
    // Someone fulfilled it a moment ago; the tracker is at PayPal and stored either way.
    if (!(e instanceof InvalidTransition)) throw e;
  }
  eventsRepo.add(db, order.id, 'tracking_added', 'seller', {
    carrier,
    paypalCarrier: input.carrier,
    trackingNumber: input.trackingNumber,
  });
  return { order: ordersRepo.byId(db, order.id)!, trackers: ordersRepo.trackers(db, order.id) };
}
