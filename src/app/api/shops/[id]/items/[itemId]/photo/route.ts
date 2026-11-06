// The item's photo (owner only), for a draft item on the review screen or a live one on the Menu tab.
// POST /api/shops/[id]/items/[itemId]/photo: multipart field "photo" → 200 { photoUrl: "/i/<file>" }. Rotated upright,
//   fitted to 1200 px, WebP, metadata dropped; replaces (and deletes) an earlier upload. Errors: 404 NOT_FOUND (no
//   such shop, or not this browser's) or ITEM_NOT_FOUND; 400 NO_PHOTOS; 413 PHOTO_TOO_LARGE (over 15 MB or 50 MP);
//   415 BAD_IMAGE ("We couldn't open that photo. Try a JPG or PNG."); 411 LENGTH_REQUIRED; 429 RATE_LIMITED.
// DELETE /api/shops/[id]/items/[itemId]/photo → 200 { photoUrl: null }: the designed fallback shows again.
import { getDb } from '@/lib/db';
import { clearItemPhoto, setItemPhoto } from '@/lib/catalog/photos';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allowSetup } from '@/lib/rate-limit';
import { readOnePhoto } from '@/lib/uploads';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id, itemId } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  if (!allowSetup('photos', clientIp(req))) {
    return jsonError(429, 'RATE_LIMITED', 'You’ve uploaded a lot of photos in the last hour. Try again later.');
  }
  try {
    const photo = await readOnePhoto(req, 'photo');
    return Response.json({ photoUrl: await setItemPhoto(getDb(), shop.id, itemId, photo) });
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/items/[itemId]/photo');
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id, itemId } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  try {
    await clearItemPhoto(getDb(), shop.id, itemId);
    return Response.json({ photoUrl: null });
  } catch (err) {
    return errorResponse(err, 'DELETE /api/shops/[id]/items/[itemId]/photo');
  }
}
