// GET /i/[file]: an item photo or shop cover a seller uploaded (src/lib/catalog/photos.ts). Public, like the
// storefront it belongs to; the random file name is the only way to it. Only `img_<20 base32>.webp` names inside
// ${UPLOADS_DIR}/items are served (no other file, no path); a file never changes once written, so it caches forever.
import { readUploadedPhoto } from '@/lib/catalog/photos';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await ctx.params;
  const bytes = await readUploadedPhoto(file);
  if (!bytes) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}
