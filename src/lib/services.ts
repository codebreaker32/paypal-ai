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

/**
 * Runs after an order becomes paid: writes the AI order brief in the background (spec §9 A2).
 * Fire-and-forget: it yields first so the sync that called it finishes untouched, and writeOrderBrief never throws.
 * Without ANTHROPIC_API_KEY (tests, e2e) writeOrderBrief stores the labelled template brief.
 */
async function onPaid(order: Order): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  // Loaded lazily so route handlers that never see a payment don't load the Agent Toolkit.
  const { writeOrderBrief } = await import('@/lib/ai/brief');
  await writeOrderBrief({ db: getDb() }, order.id);
}

export function getOrderDeps(): OrderDeps {
  return {
    db: getDb(),
    paypal: g.__shelfiePayPalOverride ?? getPayPal(),
    appUrl: getConfig().appUrl,
    onPaid,
  };
}
