// The shop's cover photo (owner only), the wide photo at the top of the storefront.
// POST /api/shops/[id]/cover: multipart field "photo" → 200 { coverUrl: "/i/<file>" }. Rotated upright, fitted to
//   2000 px, WebP, metadata dropped; replaces (and deletes) an earlier upload. Errors as for an item photo
//   (src/app/api/shops/[id]/items/[itemId]/photo/route.ts): 404, 400 NO_PHOTOS, 413, 415 BAD_IMAGE, 411, 429.
// DELETE /api/shops/[id]/cover → 200 { coverUrl: null }.
// GET /api/shops/[id]/cover → 200 { coverUrl } (the current cover or null), for the dashboard's Menu tab.
import { getDb } from '@/lib/db';
import { clearShopCover, setShopCover } from '@/lib/catalog/photos';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allowSetup } from '@/lib/rate-limit';
import { readOnePhoto } from '@/lib/uploads';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  return Response.json({ coverUrl: shop.coverUrl }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  if (!allowSetup('photos', clientIp(req))) {
    return jsonError(429, 'RATE_LIMITED', 'You’ve uploaded a lot of photos in the last hour. Try again later.');
  }
  try {
    const photo = await readOnePhoto(req, 'photo');
    return Response.json({ coverUrl: await setShopCover(getDb(), shop.id, photo) });
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/cover');
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  try {
    await clearShopCover(getDb(), shop.id);
    return Response.json({ coverUrl: null });
  } catch (err) {
    return errorResponse(err, 'DELETE /api/shops/[id]/cover');
  }
}
