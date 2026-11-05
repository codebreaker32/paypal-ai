// The buyer backed out on PayPal: GET /api/paypal/cancel?o=<orderId>. Cancel an order still waiting for approval
// (a paid one is left alone), then show the receipt.
import { ORDER_REF } from '@/app/o/[ref]/receipt-view';
import { cancelOrder } from '@/lib/orders/service';
import { getOrderDeps } from '@/lib/services';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const ref = new URL(req.url).searchParams.get('o') ?? '';
  if (!ORDER_REF.test(ref)) return seeOther('/');
  try {
    await cancelOrder(getOrderDeps(), ref);
  } catch (e) {
    console.warn(`[shelfie] cancel URL for ${ref} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return seeOther(`/o/${ref}`);
}

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });
}
