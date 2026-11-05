// GET /api/shops/[id]/photo/[n] (owner): page n (1-based) of the menu photos, as stored (JPEG).
import { readUpload } from '@/lib/uploads';
import { jsonError, notFound, ownedShop } from '@/lib/catalog/http';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/api/shops/[id]/photo/[n]'>): Promise<Response> {
  const { id, n } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  const page = Number(n);
  const rel = Number.isInteger(page) && page >= 1 ? shop.menuPhotoPaths[page - 1] : undefined;
  if (!rel) return jsonError('NOT_FOUND', 'No such photo.', 404);
  try {
    const jpeg = await readUpload(rel);
    return new Response(new Uint8Array(jpeg), {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch {
    return jsonError('NOT_FOUND', 'That photo is no longer on this server.', 404);
  }
}
