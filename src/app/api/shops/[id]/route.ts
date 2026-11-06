// PATCH /api/shops/[id] (owner): { name?, about?, pickupNotes?, fulfillment?, shippingFeeCents?, status?, payeeEmail? }
// → 200 { shop }. `status` only toggles live ↔ paused on a published shop (the dashboard's pause). `payeeEmail` is the
// seller's PayPal email (400 INVALID_PAYEE_EMAIL if malformed; null is refused once live, except for the demo shop).
import { getDb } from '@/lib/db';
import { applyShopPatch, parseShopPatch } from '@/lib/catalog/edits';
import { errorResponse, notFound, ownedShop, readJson } from '@/lib/catalog/http';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: RouteContext<'/api/shops/[id]'>): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  try {
    const patch = parseShopPatch(await readJson(req));
    return Response.json({ shop: applyShopPatch(getDb(), shop, patch) });
  } catch (err) {
    return errorResponse(err, 'PATCH /api/shops/[id]');
  }
}
