// A menu photo as the two GET routes serve it (public /s/[slug]/photo/[n], owner /api/shops/[id]/photo/[n]): the stored
// file as is, or with ?size=avatar the small square the shop's picture shows (`menuPhotoAvatarSrc`), so a 40 to 96 px
// tile never loads the full 1600 px photo.
import { normalizePhoto, type PhotoEncoding } from '@/lib/uploads';

/** The avatar tile is at most 96 px a side (80 px on phones): its centre square, 160 px, WebP. */
export const MENU_PHOTO_AVATAR: PhotoEncoding = { maxEdge: 160, format: 'webp', quality: 80, square: true };

/**
 * The response for one stored menu photo: the original bytes with `type`, or the avatar's square as WebP when the
 * request asks for it (`?size=avatar`), each with its own Cache-Control. Null when the stored file can't be made into
 * a square (not a photo after all): the route answers 404, as for a missing file.
 */
export async function menuPhotoResponse(
  req: Request,
  stored: Buffer,
  type: string,
  cache: { original: string; avatar: string },
): Promise<Response | null> {
  const avatar = new URL(req.url).searchParams.get('size') === 'avatar';
  const body = avatar ? await normalizePhoto(stored, MENU_PHOTO_AVATAR).catch(() => null) : stored;
  if (!body) return null;
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': avatar ? 'image/webp' : type,
      'cache-control': avatar ? cache.avatar : cache.original,
      'x-content-type-options': 'nosniff',
    },
  });
}
