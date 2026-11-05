// Seller actions on a paid order (spec §4 Dashboard / Order detail, §8 Add tracking):
// Mark picked up (pickup orders) and Add tracking (shipping orders, sent to PayPal through the Agent Toolkit).
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import type { Order, Shop, Tracker } from '@/lib/domain/types';
import { markFulfilled, type OrderDeps } from '@/lib/orders/service';
import { InvalidTransition } from '@/lib/orders/state';
import { createSellerToolkit, ScopeError, ToolkitError, type ShopScope } from '@/lib/paypal/toolkit';
import { shopScope } from './scope';

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

// ---- carriers -------------------------------------------------------------------------------------------------

/** What the seller picks, in the order shown. `id` is the PayPal carrier code. */
export const CARRIERS = [
  { id: 'USPS', label: 'USPS' },
  { id: 'UPS', label: 'UPS' },
  { id: 'FEDEX', label: 'FedEx' },
  { id: 'DHL', label: 'DHL' },
  { id: 'OTHER', label: 'Other' },
] as const;
export type CarrierId = (typeof CARRIERS)[number]['id'];

export interface TrackingInput {
  carrier: CarrierId;
  trackingNumber: string;
  /** Required for OTHER: the carrier's name as the buyer knows it. */
  carrierName: string | null;
}

const TRACKING_NUMBER = /^[A-Za-z0-9-]{5,40}$/;
const KEYS = new Set(['carrier', 'trackingNumber', 'carrierName']);

export function parseTrackingInput(body: unknown): { ok: true; value: TrackingInput } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send { carrier, trackingNumber }.' };
  const b = body as Record<string, unknown>;
  const extra = Object.keys(b).find((k) => !KEYS.has(k));
  if (extra) return { ok: false, message: `"${extra.slice(0, 40)}" is not accepted.` };
  const carrier = CARRIERS.find((c) => c.id === b.carrier)?.id;
  if (!carrier) return { ok: false, message: 'Pick a carrier: USPS, UPS, FedEx, DHL or Other.' };
  const trackingNumber = typeof b.trackingNumber === 'string' ? b.trackingNumber.replace(/\s+/g, '') : '';
  if (!TRACKING_NUMBER.test(trackingNumber)) {
    return { ok: false, message: 'Enter the tracking number from the label: 5 to 40 letters and digits.' };
  }
  let carrierName: string | null = null;
  if (carrier === 'OTHER') {
    carrierName = typeof b.carrierName === 'string' ? b.carrierName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (!carrierName) return { ok: false, message: 'Enter the name of the carrier.' };
  }
  return { ok: true, value: { carrier, trackingNumber, carrierName } };
}

/** The carrier as shown to the seller and the buyer (get_order_status reads it back from our tracker row). */
export function carrierLabel(input: Pick<TrackingInput, 'carrier' | 'carrierName'>): string {
  if (input.carrier === 'OTHER') return input.carrierName ?? 'Other';
  return CARRIERS.find((c) => c.id === input.carrier)!.label;
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
