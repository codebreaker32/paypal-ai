// POST /api/shops/[id]/orders/[orderId]/tracking (owner): { carrier, trackingNumber, carrierName? } → { order, trackers,
// atPayPal }. A platform-paid order's tracker goes to PayPal
// through the Agent Toolkit; a seller-paid order's is saved here only (spec §8a). Then the order is fulfilled.
import { getOwnedShop } from '@/lib/auth/owner';
import { getOrderDeps } from '@/lib/services';
import { addTracking, parseTrackingInput, SellerActionError } from '@/lib/seller/actions';
import { jsonError } from '@/lib/http/json-error';
import { json, readJson } from '@/lib/seller/http';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: RouteContext<'/api/shops/[id]/orders/[orderId]/tracking'>): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  const { id, orderId } = await ctx.params;
  const shop = await getOwnedShop(id);
  if (!shop) return jsonError(404, 'NOT_FOUND', 'Shop not found.');
  const parsed = parseTrackingInput(await readJson(req));
  if (!parsed.ok) return jsonError(400, 'INVALID_TRACKING', parsed.message);
  try {
    const { order, trackers, atPayPal } = await addTracking(getOrderDeps(), shop, orderId, parsed.value);
    return json({ order, trackers, atPayPal });
  } catch (e) {
    if (e instanceof SellerActionError) return jsonError(e.status, e.code, e.message);
    console.error(`[shelfie] ${'tracking'} failed: ${e instanceof Error ? e.message : String(e)}`);
    return jsonError(500, 'INTERNAL', 'Something went wrong on our side. Please try again.');
  }
}
