// Live PayPal sandbox suite. Skipped without PAYPAL_CLIENT_ID / PAYPAL_SECRET_KEY. Run: npm run test:sandbox
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPayPalClient } from '@/lib/paypal/client';
import { PayPalApiError } from '@/lib/paypal/types';
import { createSellerToolkit } from '@/lib/paypal/toolkit';

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
});
