// PayPal webhook (spec §7, "three ways to paid"): verify the signature, dedupe by event id, map the resource to our
// order and re-read the order from PayPal through syncOrder. The payload's own status is never trusted.
import { getConfig } from '@/lib/config';
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import { syncOrder } from '@/lib/orders/service';
import { getPayPal } from '@/lib/paypal';
import { getOrderDeps } from '@/lib/services';
import { jsonError } from '@/lib/http/json-error';
import { json } from '@/lib/seller/http';

export const runtime = 'nodejs';

let warnedUnverified = false;

interface WebhookEvent {
  id?: unknown;
  event_type?: unknown;
  resource?: { id?: unknown; supplementary_data?: { related_ids?: { order_id?: unknown } } } | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, 128) : null);

/** The PayPal order id an event is about: the order itself, or the order a capture belongs to. */
function paypalOrderIdOf(eventType: string, e: WebhookEvent): string | null {
  if (eventType === 'CHECKOUT.ORDER.APPROVED') return str(e.resource?.id);
  if (eventType.startsWith('PAYMENT.CAPTURE.')) return str(e.resource?.supplementary_data?.related_ids?.order_id);
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();

  const webhookId = getConfig().paypalWebhookId;
  let verified = false;
  if (webhookId) {
    // Cheap guard: an unsigned POST must not cost us an outbound PayPal call.
    const h = req.headers;
    const signed = ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo'].every((k) => h.get(k));
    if (!signed) return jsonError(400, 'BAD_SIGNATURE', 'Missing PayPal signature headers.');
    try {
      verified = await getPayPal().verifyWebhookSignature(req.headers, raw, webhookId);
    } catch (e) {
      // PayPal couldn't verify right now: a 5xx makes PayPal deliver the event again later.
      console.warn(`[shelfie] webhook: signature check failed to run: ${e instanceof Error ? e.message : String(e)}`);
      return jsonError(503, 'VERIFY_UNAVAILABLE', 'Could not verify the webhook signature right now.');
    }
    if (!verified) return jsonError(400, 'BAD_SIGNATURE', 'Webhook signature verification failed.');
  } else if (process.env.NODE_ENV === 'production') {
    return jsonError(503, 'WEBHOOK_NOT_CONFIGURED', 'PAYPAL_WEBHOOK_ID is not set, so webhooks cannot be verified.');
  } else if (!warnedUnverified) {
    warnedUnverified = true;
    console.warn('[shelfie] PAYPAL_WEBHOOK_ID is not set: accepting PayPal webhooks WITHOUT signature verification (development only).');
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return jsonError(400, 'BAD_PAYLOAD', 'The webhook body is not JSON.');
  }
  const id = str(event?.id);
  const eventType = str(event?.event_type);
  if (!id || !eventType) return jsonError(400, 'BAD_PAYLOAD', 'The webhook event has no id or event_type.');

  const deps = getOrderDeps();
  const fresh = eventsRepo.recordWebhook(deps.db, { id, eventType, resourceId: str(event.resource?.id), verified });
  if (!fresh) return json({ ok: true, duplicate: true });

  const paypalOrderId = paypalOrderIdOf(eventType, event);
  if (!paypalOrderId) return json({ ok: true, ignored: 'event_type' });
  const order = ordersRepo.byPayPalId(deps.db, paypalOrderId);
  if (!order) return json({ ok: true, ignored: 'unknown_order' });

  try {
    const synced = await syncOrder(deps, order.id, 'webhook');
    return json({ ok: true, status: synced.status });
  } catch (e) {
    // Un-record the event and answer 5xx so PayPal redelivers it (the poller only covers recent orders).
    // A concurrent duplicate is harmless: syncOrder is compare-and-set guarded.
    eventsRepo.forgetWebhook(deps.db, id);
    console.warn(`[shelfie] webhook ${eventType} for order ${order.number}: sync failed, asking PayPal to redeliver: ${e instanceof Error ? e.message : String(e)}`);
    return jsonError(503, 'SYNC_FAILED', 'Could not re-read the order from PayPal; please redeliver.');
  }
}
