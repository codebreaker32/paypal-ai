// Browser-side calls for the seller dashboard and order detail.
// Task 8 routes: GET orders, POST fulfil, POST tracking. Task 6 routes (wave-2 contract): PATCH shop status, PATCH items.
import { ApiError, call as request } from '@/lib/client/http';
import type { ItemWithVariants, Order, Shop, Tracker } from '@/lib/domain/types';

export { ApiError };

/** The dashboard and the order detail re-read SQLite this often. */
export const POLL_MS = 5000;

const FALLBACK: Record<number, string> = {
  404: "We couldn’t find that. Reload the page.",
  409: 'This order changed in the meantime. Reload the page.',
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const { body } = await request<T>(
    url,
    { ...init, headers: { 'content-type': 'application/json', ...init?.headers } },
    { fallbackCode: (status) => `HTTP_${status}`, fallbackMessage: (status) => FALLBACK[status] },
  );
  return body;
}

export const fetchOrders = (shopId: string) =>
  call<{ orders: Order[]; paypalReachable?: boolean }>(`/api/shops/${shopId}/orders`);

export const markPickedUp = (shopId: string, orderId: string) =>
  call<{ order: Order }>(`/api/shops/${shopId}/orders/${orderId}/fulfil`, { method: 'POST' });

export const addTracking = (shopId: string, orderId: string, input: { carrier: string; trackingNumber: string; carrierName?: string }) =>
  call<{ order: Order; trackers: Tracker[]; atPayPal: boolean }>(`/api/shops/${shopId}/orders/${orderId}/tracking`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const setShopStatus = (shopId: string, status: 'live' | 'paused') =>
  call<{ shop: Shop }>(`/api/shops/${shopId}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const setSoldOut = (shopId: string, itemId: string, soldOut: boolean) =>
  call<{ items: ItemWithVariants[] }>(`/api/shops/${shopId}/items`, {
    method: 'PATCH',
    body: JSON.stringify({ updates: [{ itemId, soldOut }] }),
  });
