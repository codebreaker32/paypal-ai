// Composition root: process-wide wiring for route handlers and the poller.
// Library code (src/lib/orders, src/lib/mcp, …) takes these deps as arguments instead of importing them.
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import type { Order } from '@/lib/domain/types';
import type { OrderDeps } from '@/lib/orders/service';
import { getPayPal } from '@/lib/paypal';
import type { PayPalPort } from '@/lib/paypal/types';

const g = globalThis as unknown as { __shelfiePayPalOverride?: PayPalPort };

/** Test hook: route handlers and the poller use this PayPal instead of the real sandbox client. */
export function setPayPalForServices(p: PayPalPort | undefined): void {
  g.__shelfiePayPalOverride = p;
}

/** Runs after an order becomes paid. Task 8 points this at the AI order brief. Never throws. */
async function onPaid(order: Order): Promise<void> {
  void order;
}

export function getOrderDeps(): OrderDeps {
  return {
    db: getDb(),
    paypal: g.__shelfiePayPalOverride ?? getPayPal(),
    appUrl: getConfig().appUrl,
    onPaid,
  };
}
