// Live PayPal sandbox suite. Skipped without PAYPAL_CLIENT_ID / PAYPAL_SECRET_KEY. Run: npm run test:sandbox
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPayPalClient } from '@/lib/paypal/client';
import { PayPalApiError } from '@/lib/paypal/types';
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { createSellerToolkit, ToolkitError, type ToolkitLike } from '@/lib/paypal/toolkit';

const have = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_SECRET_KEY;

describe.skipIf(!have)('PayPal sandbox', () => {
  const client = createPayPalClient({
    base: 'https://api-m.sandbox.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    secret: process.env.PAYPAL_SECRET_KEY ?? '',
  });
  const input = {
    shopName: 'Shelfie Test Bakery',
    orderId: `ord_${randomUUID().slice(0, 8)}`,
    orderNumber: `SHF-${randomUUID().slice(0, 6).toUpperCase()}`,
    items: [{ name: 'Croissant', unitCents: 450, qty: 2, sku: 'PROD-TEST', kind: 'PHYSICAL' as const }],
    shippingCents: 0,
    fulfillment: 'pickup' as const,
    returnUrl: 'http://localhost:3000/return',
    cancelUrl: 'http://localhost:3000/cancel',
    payeeEmail: null,
  };
  const requestId = `test-${randomUUID()}`;

  it('creates a catalog product', async () => {
    const p = await client.createProduct({ name: 'Shelfie test croissant', type: 'PHYSICAL', category: 'FOOD_RETAIL_AND_SERVICE' }, `prod-${randomUUID()}`);
    expect(p.id).toMatch(/^PROD-/);
  });

  let orderId = '';
  it('creates an order that needs payer action, and the same request id returns the same order', async () => {
    const o = await client.createOrder(input, requestId);
    orderId = o.id;
    expect(o.status).toBe('PAYER_ACTION_REQUIRED');
    expect(o.approveUrl).toContain('sandbox.paypal.com');
    const again = await client.createOrder(input, requestId);
    expect(again.id).toBe(o.id);
  });

  it('refuses to capture an unapproved order with ORDER_NOT_APPROVED', async () => {
    const err = await client.captureOrder(orderId, `cap-${orderId}`).catch((e) => e);
    expect(err).toBeInstanceOf(PayPalApiError);
    expect(err.issue).toBe('ORDER_NOT_APPROVED');
  });

  it('reads the order back through the REST client and the Agent Toolkit', async () => {
    const rest = await client.getOrder(orderId);
    expect(rest.purchase_units[0].custom_id).toBe(input.orderId);
    expect(rest.purchase_units[0].invoice_id).toBe(input.orderNumber);
    const toolkit = createSellerToolkit({ orderIds: new Set([orderId]), productIds: new Set() });
    const viaToolkit = await toolkit.getOrder(orderId);
    expect(viaToolkit.id).toBe(orderId);
  });

  it('a forced rebuild of the shared toolkit still authenticates (clock past the 30-minute TTL)', async () => {
    const toolkit = createSellerToolkit({ orderIds: new Set([orderId]), productIds: new Set() }, { now: () => Date.now() + 31 * 60_000 });
    expect((await toolkit.getOrder(orderId)).id).toBe(orderId);
  });

  it('a toolkit holding an expired token gets a real 401, is rebuilt once and the call is retried (R1)', async () => {
    const real = () =>
      new PayPalAgentToolkit({
        clientId: process.env.PAYPAL_CLIENT_ID ?? '',
        clientSecret: process.env.PAYPAL_SECRET_KEY ?? '',
        configuration: { context: { sandbox: true }, actions: { orders: { get: true }, shipment: { create: true, get: true } } },
      });
    const stale = real();
    // Simulate the shared token having expired after this instance cached it (toolkit 1.11.0 internals).
    (stale as unknown as { client: { _accessToken: string } }).client._accessToken = 'A21AAexpiredShelfieTestToken';
    let builds = 0;
    const factory = () => (++builds === 1 ? stale : real()) as unknown as ToolkitLike;
    const toolkit = createSellerToolkit({ orderIds: new Set([orderId]), productIds: new Set() }, { factory });
    expect((await toolkit.getOrder(orderId)).id).toBe(orderId);
    expect(builds).toBe(2);
  });

  it('the toolkit reports a scoped but non-existent order as ToolkitError', async () => {
    const ghost = 'ZZZZZZZZZZZZZZZZZ';
    const toolkit = createSellerToolkit({ orderIds: new Set([ghost]), productIds: new Set() });
    await expect(toolkit.getOrder(ghost)).rejects.toBeInstanceOf(ToolkitError);
  });
});
