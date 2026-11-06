// The shop's logo (owner only), its picture in the shop page's avatar, the dashboard header and the start page.
// POST /api/shops/[id]/logo: multipart field "photo" → 200 { logoUrl: "/i/<file>" }. Rotated upright, the centre
//   square cut at 512 px, WebP, metadata dropped; replaces (and deletes) an earlier upload. The cover route's decoder,
//   limits and errors (src/app/api/shops/[id]/cover/route.ts): 404, 400 NO_PHOTOS, 413, 415 BAD_IMAGE, 411, 429.
// DELETE /api/shops/[id]/logo → 204 (the avatar falls back to the cover, a menu photo or a drawing).
import { getDb } from '@/lib/db';
import { clearShopLogo, setShopLogo } from '@/lib/catalog/photos';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allowSetup } from '@/lib/rate-limit';
import { readOnePhoto } from '@/lib/uploads';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  if (!allowSetup('photos', clientIp(req))) {
    return jsonError(429, 'RATE_LIMITED', 'You’ve uploaded a lot of photos in the last hour. Try again later.');
  }
  try {
    const photo = await readOnePhoto(req, 'photo');
    return Response.json({ logoUrl: await setShopLogo(getDb(), shop.id, photo) });
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/logo');
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  try {
    await clearShopLogo(getDb(), shop.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err, 'DELETE /api/shops/[id]/logo');
  }
}
