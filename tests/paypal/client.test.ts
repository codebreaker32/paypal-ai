/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it } from 'vitest';
import { PayPalApiError } from '@/lib/paypal/types';
import { fixture, makeClient, tokenReply } from './helpers';

const input = {
  shopName: 'Fixture Bakery',
  orderId: 'ord_1',
  orderNumber: 'SHF-ABC',
  items: [{ name: 'Croissant', unitCents: 450, qty: 2, sku: 'PROD-1', kind: 'PHYSICAL' as const }],
  shippingCents: 0,
  fulfillment: 'pickup' as const,
  returnUrl: 'http://x/return',
  cancelUrl: 'http://x/cancel',
};

describe('token handling', () => {
  it('fetches the token once for two calls', async () => {
    const { client, calls } = makeClient({ 'GET /v2/checkout/orders/A1': [{ status: 200, body: { id: 'A1', status: 'CREATED', purchase_units: [] } }] });
    await client.getOrder('A1');
    await client.getOrder('A1');
    expect(calls.filter((c) => c.url.endsWith('/v1/oauth2/token'))).toHaveLength(1);
  });

  it('refreshes 60s before expiry', async () => {
    let t = 0;
    const { client, calls } = makeClient(
      {
        'POST /v1/oauth2/token': [tokenReply(100)],
        'GET /v2/checkout/orders/A1': [{ status: 200, body: { id: 'A1' } }],
      },
      { now: () => t },
    );
    await client.getOrder('A1');
    t = 39_000;
    await client.getOrder('A1');
    expect(calls.filter((c) => c.url.endsWith('/token'))).toHaveLength(1);
    t = 41_000;
    await client.getOrder('A1');
    expect(calls.filter((c) => c.url.endsWith('/token'))).toHaveLength(2);
  });

  it('refreshes once and retries once after a 401', async () => {
    const { client, calls } = makeClient({
      'GET /v2/checkout/orders/A1': [{ status: 401, body: { name: 'AUTHENTICATION_FAILURE' } }, { status: 200, body: { id: 'A1' } }],
    });
    const o = await client.getOrder('A1');
    expect(o.id).toBe('A1');
    expect(calls.filter((c) => c.url.endsWith('/token'))).toHaveLength(2);
  });

  it('gives up after a second 401', async () => {
    const { client } = makeClient({ 'GET /v2/checkout/orders/A1': [{ status: 401, body: { name: 'AUTHENTICATION_FAILURE' } }] });
    await expect(client.getOrder('A1')).rejects.toMatchObject({ status: 401 });
  });
});

describe('createOrder', () => {
  it('sends PayPal-Request-Id and returns the payer-action link', async () => {
    const f = fixture('order-created');
    const { client, calls } = makeClient({ 'POST /v2/checkout/orders': [f] });
    const r = await client.createOrder(input, 'ord-ord_1');
    expect(r).toEqual({ id: f.body.id, status: 'PAYER_ACTION_REQUIRED', approveUrl: expect.stringContaining('checkoutnow?token=') });
    const call = calls.find((c) => c.url.endsWith('/v2/checkout/orders'))!;
    expect(call.headers['PayPal-Request-Id']).toBe('ord-ord_1');
    expect(call.headers.Authorization).toBe('Bearer tok');
    expect(call.body.purchase_units[0].custom_id).toBe('ord_1');
  });

  it('falls back to the approve link', async () => {
    const { client } = makeClient({
      'POST /v2/checkout/orders': [{ status: 201, body: { id: 'X', status: 'CREATED', links: [{ rel: 'approve', href: 'https://p/approve' }] } }],
    });
    expect((await client.createOrder(input, 'r')).approveUrl).toBe('https://p/approve');
  });
});

describe('errors and retries', () => {
  it('maps the not-approved 422 to PayPalApiError with the issue code', async () => {
    const { client } = makeClient({ 'POST /v2/checkout/orders/A1/capture': [fixture('not-approved-422')] });
    const err = await client.captureOrder('A1', 'cap-A1').catch((e) => e);
    expect(err).toBeInstanceOf(PayPalApiError);
    expect(err).toMatchObject({ status: 422, errorName: 'UNPROCESSABLE_ENTITY', issue: 'ORDER_NOT_APPROVED' });
    expect(err.debugId).toBeTruthy();
  });

  it('keeps ORDER_ALREADY_CAPTURED and INSTRUMENT_DECLINED issues', async () => {
    for (const [name, issue] of [['already-captured-422', 'ORDER_ALREADY_CAPTURED'], ['capture-declined-422', 'INSTRUMENT_DECLINED']] as const) {
      const { client } = makeClient({ 'POST /v2/checkout/orders/A1/capture': [fixture(name)] });
      await expect(client.captureOrder('A1', 'r')).rejects.toMatchObject({ issue });
    }
  });

  it('returns the completed capture with the capture id', async () => {
    const { client, calls } = makeClient({ 'POST /v2/checkout/orders/A1/capture': [fixture('capture-completed')] });
    const o = await client.captureOrder('A1', 'cap-A1');
    expect(o.purchase_units[0].payments?.captures?.[0].id).toBe('3C679366HH908993F');
    const call = calls.find((c) => c.url.endsWith('/capture'))!;
    expect(call.headers['PayPal-Request-Id']).toBe('cap-A1');
  });

  it('retries 5xx twice then throws', async () => {
    const { client, calls, sleeps } = makeClient({ 'GET /v2/checkout/orders/A1': [{ status: 503, body: { name: 'SERVICE_UNAVAILABLE' } }] });
    await expect(client.getOrder('A1')).rejects.toMatchObject({ status: 503 });
    expect(calls.filter((c) => c.url.endsWith('/orders/A1'))).toHaveLength(3);
    expect(sleeps).toHaveLength(2);
  });

  it('retries 429 and network errors, then succeeds', async () => {
    const { client, calls } = makeClient({
      'GET /v2/checkout/orders/A1': [{ status: 429, body: {} }, new TypeError('fetch failed'), { status: 200, body: { id: 'A1' } }],
    });
    expect((await client.getOrder('A1')).id).toBe('A1');
    expect(calls.filter((c) => c.url.endsWith('/orders/A1'))).toHaveLength(3);
  });

  it('does not retry a 4xx', async () => {
    const { client, calls } = makeClient({ 'GET /v2/checkout/orders/A1': [{ status: 404, body: { name: 'RESOURCE_NOT_FOUND', details: [{ issue: 'INVALID_RESOURCE_ID' }] } }] });
    await expect(client.getOrder('A1')).rejects.toMatchObject({ status: 404, issue: 'INVALID_RESOURCE_ID' });
    expect(calls.filter((c) => c.url.endsWith('/orders/A1'))).toHaveLength(1);
  });
});
