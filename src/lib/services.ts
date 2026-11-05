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
 * With a test PayPal in place (unit tests, e2e fixtures) the PayPal order ids are fake, so the labelled template
 * brief is stored instead of calling Claude and the sandbox toolkit.
 */
async function onPaid(order: Order): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  // Loaded lazily so route handlers that never see a payment don't load the Agent Toolkit.
  const [{ templateBrief, writeOrderBrief }, ordersRepo] = await Promise.all([import('@/lib/ai/brief'), import('@/lib/db/repos/orders')]);
  const db = getDb();
  if (g.__shelfiePayPalOverride) {
    ordersRepo.update(db, order.id, { brief: templateBrief(order), briefSource: 'template' });
    return;
  }
  await writeOrderBrief({ db }, order.id);
}

export function getOrderDeps(): OrderDeps {
  return {
    db: getDb(),
    paypal: g.__shelfiePayPalOverride ?? getPayPal(),
    appUrl: getConfig().appUrl,
    onPaid,
  };
}
