// POST /api/shops: start a shop from 1-4 menu photos (multipart field "photos") or from a sample
// menu (JSON { sample }). Answers 201 { shopId } and sets this browser's owner cookie.
// Errors: NO_PHOTOS 400, TOO_MANY_PHOTOS 400, PHOTO_TOO_LARGE 413 (one photo over 15 MB, or a request
// over 4 × 15 MB + 1 MB, refused from its Content-Length before the body is read), BAD_IMAGE 415,
// UNKNOWN_SAMPLE 400, BODY_TOO_LARGE 413 (a JSON body over 64 KB), RATE_LIMITED 429 (over 10 shops from one address in an hour, refused before the body is read).
// Reading the menu happens next, on the setup page (POST /api/shops/[id]/extract).
import { setOwnerCookie } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import { isSampleId } from '@/lib/ai/samples';
import { createShopFromPhotos, createShopFromSample, type CreatedShop } from '@/lib/catalog/setup';
import { errorResponse } from '@/lib/catalog/http';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { BodyTooLargeError, MAX_JSON_BODY_BYTES, readJsonLimited } from '@/lib/http/read-body';
import { allowSetup } from '@/lib/rate-limit';
import { MAX_PHOTOS, UploadError, checkUploadSize, readFileLimited } from '@/lib/uploads';

export const runtime = 'nodejs';

async function photosFrom(req: Request): Promise<Buffer[]> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new UploadError('NO_PHOTOS');
  }
  const files = form.getAll('photos').filter((f): f is File => typeof f !== 'string');
  if (files.length === 0) throw new UploadError('NO_PHOTOS');
  if (files.length > MAX_PHOTOS) throw new UploadError('TOO_MANY_PHOTOS');
  return Promise.all(files.map(readFileLimited));
}

export async function POST(req: Request): Promise<Response> {
  const type = req.headers.get('content-type') ?? '';
  if (!allowSetup('shops', clientIp(req))) {
    return jsonError(429, 'RATE_LIMITED', 'You’ve started a lot of shops in the last hour. Try again later.');
  }
  try {
    checkUploadSize(req);
    const db = getDb();
    let created: CreatedShop;
    if (type.includes('multipart/form-data')) {
      created = await createShopFromPhotos(db, await photosFrom(req));
    } else if (type.includes('application/json')) {
      const body = (await readJsonLimited(req, MAX_JSON_BODY_BYTES).catch((e: unknown) => {
        if (e instanceof BodyTooLargeError) throw e; // a 413 through errorResponse
        return null;
      })) as { sample?: unknown } | null;
      if (!isSampleId(body?.sample)) return jsonError(400, 'UNKNOWN_SAMPLE', 'Pick one of the sample menus.');
      created = await createShopFromSample(db, body.sample);
    } else {
      throw new UploadError('NO_PHOTOS');
    }
    // The raw owner token lives only in this browser's cookie; the database keeps its hash.
    await setOwnerCookie(created.shop.id, created.ownerToken);
    return Response.json({ shopId: created.shop.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'POST /api/shops');
  }
}
