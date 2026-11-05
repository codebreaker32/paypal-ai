// POST /api/shops/[id]/orders/[orderId]/tracking (owner): { carrier, trackingNumber, carrierName? } → PayPal tracker
// through the Agent Toolkit → tracker row → order fulfilled.
import { getOwnedShop } from '@/lib/auth/owner';
import { getOrderDeps } from '@/lib/services';
import { addTracking, parseTrackingInput, SellerActionError } from '@/lib/seller/actions';
import { json, jsonError, readJson } from '@/lib/seller/http';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: RouteContext<'/api/shops/[id]/orders/[orderId]/tracking'>): Promise<Response> {
  const { id, orderId } = await ctx.params;
  const shop = await getOwnedShop(id);
  if (!shop) return jsonError(404, 'NOT_FOUND', 'Shop not found.');
  const parsed = parseTrackingInput(await readJson(req));
  if (!parsed.ok) return jsonError(400, 'INVALID_TRACKING', parsed.message);
  try {
    const { order, trackers } = await addTracking(getOrderDeps(), shop, orderId, parsed.value);
    return json({ order, trackers });
  } catch (e) {
    if (e instanceof SellerActionError) return jsonError(e.status, e.code, e.message);
    throw e;
  }
}
