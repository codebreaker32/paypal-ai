// The owner routes for a shop's own pictures (/api/shops/[id]/cover and /api/shops/[id]/logo): one handler pair for
// both. POST takes multipart field "photo" and answers 200 { coverUrl | logoUrl: "/i/<file>" }; errors as for an item
// photo: 404 (not the owner), 400 NO_PHOTOS, 413, 415 BAD_IMAGE, 411, 429 (the setup photo limit). DELETE clears it and
// answers as the route says (`onDelete`), so each route keeps its own contract.
import { getDb } from '@/lib/db';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allowSetup } from '@/lib/rate-limit';
import { readOnePhoto } from '@/lib/uploads';
import { errorResponse, notFound, ownedShop } from './http';
import { clearShopImage, setShopImage, type ShopImage } from './photos';

type Ctx = { params: Promise<{ id: string }> };

export function shopImageRoutes(image: ShopImage, opts: { onDelete: () => Response }) {
  const where = `/api/shops/[id]/${image}`;

  async function POST(req: Request, ctx: Ctx): Promise<Response> {
    const { id } = await ctx.params;
    const shop = await ownedShop(id);
    if (!shop) return notFound();
    if (!allowSetup('photos', clientIp(req))) {
      return jsonError(429, 'RATE_LIMITED', 'You’ve uploaded a lot of photos in the last hour. Try again later.');
    }
    try {
      const photo = await readOnePhoto(req, 'photo');
      return Response.json({ [`${image}Url`]: await setShopImage(getDb(), shop.id, image, photo) });
    } catch (err) {
      return errorResponse(err, `POST ${where}`);
    }
  }

  async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
    const { id } = await ctx.params;
    const shop = await ownedShop(id);
    if (!shop) return notFound();
    try {
      await clearShopImage(getDb(), shop.id, image);
      return opts.onDelete();
    } catch (err) {
      return errorResponse(err, `DELETE ${where}`);
    }
  }

  return { POST, DELETE };
}
