import type { Requester } from './client';

/** Asks PayPal to verify a webhook delivery. Returns true only on verification_status SUCCESS. */
export async function verifyWebhook(request: Requester, headers: Headers, rawBody: string, webhookId: string): Promise<boolean> {
  const h = (n: string) => headers.get(n);
  const parts = {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
  };
  if (Object.values(parts).some((v) => !v)) return false;
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const res = await request<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    body: { ...parts, webhook_id: webhookId, webhook_event: event },
  });
  return res.verification_status === 'SUCCESS';
}
