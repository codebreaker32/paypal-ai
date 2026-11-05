// Process-wide wiring for route handlers and the poller. Library code takes deps as arguments instead.
// Placeholder until merge: the coordinator replaces setPayPalForServices with the real getPayPal() client.
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import type { OrderDeps } from '@/lib/orders/service';
import type { PayPalPort } from '@/lib/paypal/types';

const g = globalThis as unknown as { __shelfiePayPalForServices?: PayPalPort };

export function setPayPalForServices(p: PayPalPort): void {
  g.__shelfiePayPalForServices = p;
}

export function getOrderDeps(): OrderDeps {
  const paypal = g.__shelfiePayPalForServices;
  if (!paypal) {
    throw new Error('PayPal is not wired into services yet: call setPayPalForServices() at startup.');
  }
  return { db: getDb(), paypal, appUrl: getConfig().appUrl };
}
