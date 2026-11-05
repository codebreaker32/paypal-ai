// Browser-side calls for the seller dashboard and order detail.
// Task 8 routes: GET orders, POST fulfil, POST tracking. Task 6 routes (wave-2 contract): PATCH shop status, PATCH items.
import type { ItemWithVariants, Order, Shop, Tracker } from '@/lib/domain/types';

/** The dashboard and the order detail re-read SQLite this often. */
export const POLL_MS = 5000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK: Record<number, string> = {
  404: "We couldn't find that. Reload the page.",
  409: 'This order changed in the meantime. Reload the page.',
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError(0, 'NETWORK', "We couldn't reach Shelfie. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!res.ok) {
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? FALLBACK[res.status] ?? 'Something went wrong on our side. Try again in a moment.';
    throw new ApiError(res.status, code, message);
  }
  return body as T;
}

export const fetchOrders = (shopId: string) =>
  call<{ orders: Order[]; paypalReachable?: boolean }>(`/api/shops/${shopId}/orders`);

export const markPickedUp = (shopId: string, orderId: string) =>
  call<{ order: Order }>(`/api/shops/${shopId}/orders/${orderId}/fulfil`, { method: 'POST' });

export const addTracking = (shopId: string, orderId: string, input: { carrier: string; trackingNumber: string; carrierName?: string }) =>
  call<{ order: Order; trackers: Tracker[] }>(`/api/shops/${shopId}/orders/${orderId}/tracking`, {
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
