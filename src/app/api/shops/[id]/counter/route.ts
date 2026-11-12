// "Snap your counter" (owner only): one photo of the display case → proposed item photos, nothing stored.
// POST /api/shops/[id]/counter: multipart field "photo" → 200 { proposals: [{ itemId, name, confidence, image }] }, where
//   image is a 4:3 WebP data URL; the seller keeps one by uploading it to /api/shops/[id]/items/[itemId]/photo.
//   Errors: 404 NOT_FOUND; 503 NO_AI_KEY; 400 NO_PHOTOS; 413 PHOTO_TOO_LARGE; 415 BAD_IMAGE; 411 LENGTH_REQUIRED;
//   429 RATE_LIMITED (it spends the Anthropic key, so it shares the live-reading limit); 502 COUNTER_FAILED.
import { getDb } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { proposeCounterPhotos } from '@/lib/catalog/counter';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allowSetup } from '@/lib/rate-limit';
import { UploadError, readOnePhoto } from '@/lib/uploads';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  if (!getConfig().anthropicApiKey) {
    return jsonError(503, 'NO_AI_KEY', 'Finding items in a photo needs an Anthropic API key on the server.');
  }
  if (!allowSetup('readings', clientIp(req))) {
    return jsonError(429, 'RATE_LIMITED', 'You’ve read a lot of photos in the last hour. Try again later.');
  }
  try {
    const photo = await readOnePhoto(req, 'photo');
    return Response.json({ proposals: await proposeCounterPhotos(getDb(), shop.id, photo, { signal: req.signal }) });
  } catch (err) {
    if (err instanceof UploadError) return errorResponse(err, 'POST /api/shops/[id]/counter');
    console.error('POST /api/shops/[id]/counter:', err instanceof Error ? err.message : err);
    return jsonError(502, 'COUNTER_FAILED', 'We couldn’t look at that photo just now. Try again in a moment.');
  }
}
