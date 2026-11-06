// PayPal sends the buyer back here after they approve: GET /api/paypal/return?o=<orderId>&token=<paypalOrderId>.
// Sync with PayPal (approved → capture → paid), then show the receipt. Spec §7, way 1 of 3 to "paid".
import { ORDER_REF } from '@/lib/orders/receipt';
import { syncOrderShared } from '@/lib/orders/service';
import { getOrderDeps } from '@/lib/services';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const ref = new URL(req.url).searchParams.get('o') ?? '';
  if (!ORDER_REF.test(ref)) return seeOther('/');
  try {
    // Throttled per order: reloads, link previews or anyone holding the ref can't drive repeated PayPal calls.
    await syncOrderShared(getOrderDeps(), ref, 'return_url', { throttle: true });
  } catch (e) {
    // Unknown order, PayPal down or missing credentials: the receipt says what it knows, and the poller catches up.
    console.warn(`[shelfie] return URL sync for ${ref} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return seeOther(`/o/${ref}`);
}

/** 303 with a relative Location: the browser stays on whatever host PayPal sent it back to. */
function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });
}
