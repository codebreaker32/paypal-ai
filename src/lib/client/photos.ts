// Client-side checks for menu photos before they are sent to POST /api/shops.
// Limits mirror the server's saveUpload (Task 6): images only, at most 15 MB each, 1 to 4 photos.

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export type PhotoProblem = 'bad_file' | 'too_many' | 'too_large';

export type PhotoCheck = { ok: true; files: File[] } | { ok: false; kind: PhotoProblem };

function isAcceptedImage(file: File): boolean {
  if (file.size === 0) return false;
  if (file.type) return ACCEPTED_TYPES.has(file.type);
  // Some Android pickers leave the type empty; trust a known extension.
  return ACCEPTED_EXTENSIONS.test(file.name);
}

/** Checks newly picked files against the photos already chosen. Count first, then type, then size. */
export function checkNewPhotos(alreadyPicked: number, files: File[]): PhotoCheck {
  if (alreadyPicked + files.length > MAX_PHOTOS) return { ok: false, kind: 'too_many' };
  if (!files.every(isAcceptedImage)) return { ok: false, kind: 'bad_file' };
  if (files.some((f) => f.size > MAX_PHOTO_BYTES)) return { ok: false, kind: 'too_large' };
  return { ok: true, files };
}
