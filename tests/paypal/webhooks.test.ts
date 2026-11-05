import { describe, expect, it } from 'vitest';
import { makeClient } from './helpers';

const event = { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP1' } };
const headers = () =>
  new Headers({
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
    'paypal-transmission-id': 'tid',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-11-06T10:00:00Z',
  });
const route = 'POST /v1/notifications/verify-webhook-signature';

describe('verifyWebhookSignature', () => {
  it('posts the five paypal-* headers, webhook_id and the parsed event; true on SUCCESS', async () => {
    const { client, calls } = makeClient({ [route]: [{ status: 200, body: { verification_status: 'SUCCESS' } }] });
    expect(await client.verifyWebhookSignature(headers(), JSON.stringify(event), 'WEBHOOK123')).toBe(true);
    expect(calls.find((c) => c.url.endsWith('/verify-webhook-signature'))!.body).toEqual({
      auth_algo: 'SHA256withRSA',
      cert_url: 'https://api.sandbox.paypal.com/cert.pem',
      transmission_id: 'tid',
      transmission_sig: 'sig',
      transmission_time: '2026-11-06T10:00:00Z',
      webhook_id: 'WEBHOOK123',
      webhook_event: event,
    });
  });

  it('false on FAILURE', async () => {
    const { client } = makeClient({ [route]: [{ status: 200, body: { verification_status: 'FAILURE' } }] });
    expect(await client.verifyWebhookSignature(headers(), JSON.stringify(event), 'W')).toBe(false);
  });

  it('false without calling PayPal when a header is missing or the body is not JSON', async () => {
    const { client, calls } = makeClient({ [route]: [{ status: 200, body: { verification_status: 'SUCCESS' } }] });
    const h = headers();
    h.delete('paypal-transmission-sig');
    expect(await client.verifyWebhookSignature(h, JSON.stringify(event), 'W')).toBe(false);
    expect(await client.verifyWebhookSignature(headers(), 'not json', 'W')).toBe(false);
    expect(calls.filter((c) => c.url.endsWith('/verify-webhook-signature'))).toHaveLength(0);
  });
});
