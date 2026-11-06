// GET /i/library/[file]: an example photo cached from a live Pexels match (src/lib/library/pexels.ts, only with
// PEXELS_API_KEY set). Only `pexels-<digits>.webp` names inside ${UPLOADS_DIR}/library are served; a cached file never
// changes, so it caches forever. Like every example photo, it is for people only: agents never get its URL.
import { readPexelsFile } from '@/lib/library/pexels';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await ctx.params;
  const bytes = await readPexelsFile(file);
  if (!bytes) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  });
}
