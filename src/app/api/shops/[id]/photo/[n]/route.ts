// GET /api/shops/[id]/photo/[n] (owner): page n (1-based) of the menu photos, as stored (JPEG), never cached.
// ?size=avatar: its centre square at 160 px, WebP, for the shop's picture; the browser may keep it for a minute.
import { menuPhotoResponse } from '@/lib/catalog/menu-photo';
import { readUpload } from '@/lib/uploads';
import { notFound, ownedShop } from '@/lib/catalog/http';
import { jsonError } from '@/lib/http/json-error';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: RouteContext<'/api/shops/[id]/photo/[n]'>): Promise<Response> {
  const { id, n } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  const page = Number(n);
  const rel = Number.isInteger(page) && page >= 1 ? shop.menuPhotoPaths[page - 1] : undefined;
  if (!rel) return jsonError(404, 'NOT_FOUND', 'No such photo.');
  const gone = () => jsonError(404, 'NOT_FOUND', 'That photo is no longer on this server.');
  const jpeg = await readUpload(rel).catch(() => null);
  if (!jpeg) return gone();
  return (await menuPhotoResponse(req, jpeg, 'image/jpeg', { original: 'private, no-store', avatar: 'private, max-age=60' })) ?? gone();
}
