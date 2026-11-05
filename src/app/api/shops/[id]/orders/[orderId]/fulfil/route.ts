// POST /api/shops/[id]/orders/[orderId]/fulfil (owner): Mark picked up, for paid pickup orders.
import { getOwnedShop } from '@/lib/auth/owner';
import { getOrderDeps } from '@/lib/services';
import { markPickedUp, SellerActionError } from '@/lib/seller/actions';
import { json, jsonError } from '@/lib/seller/http';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: RouteContext<'/api/shops/[id]/orders/[orderId]/fulfil'>): Promise<Response> {
  const { id, orderId } = await ctx.params;
  const shop = await getOwnedShop(id);
  if (!shop) return jsonError(404, 'NOT_FOUND', 'Shop not found.');
  try {
    const order = await markPickedUp(getOrderDeps(), shop, orderId);
    return json({ order });
  } catch (e) {
    if (e instanceof SellerActionError) return jsonError(e.status, e.code, e.message);
    throw e;
  }
}
