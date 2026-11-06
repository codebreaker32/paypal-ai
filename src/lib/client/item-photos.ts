// Browser-side calls for item photos and the shop cover (owner routes; the owner cookie goes along by itself).
// A refused photo throws ApiError with the server's plain message, e.g. BAD_IMAGE "We couldn't open that photo.
// Try a JPG or PNG." or PHOTO_TOO_LARGE; check the file first with checkNewPhotos (src/lib/client/photos.ts).
import { call } from './http';

const photoForm = (file: Blob, name = 'photo.jpg') => {
  const form = new FormData();
  form.append('photo', file, file instanceof File ? file.name : name);
  return form;
};
const enc = encodeURIComponent;

/** Uploads an item's photo (a draft on the review screen or a live item); returns its new URL, "/i/<file>". */
export async function uploadItemPhoto(shopId: string, itemId: string, file: Blob): Promise<string> {
  const { body } = await call<{ photoUrl: string }>(`/api/shops/${enc(shopId)}/items/${enc(itemId)}/photo`, {
    method: 'POST',
    body: photoForm(file),
  });
  return body.photoUrl;
}

/** Removes an item's photo: the designed fallback shows again. */
export async function removeItemPhoto(shopId: string, itemId: string): Promise<void> {
  await call(`/api/shops/${enc(shopId)}/items/${enc(itemId)}/photo`, { method: 'DELETE' });
}

/** Uploads the shop's cover photo; returns its new URL. */
export async function uploadCover(shopId: string, file: Blob): Promise<string> {
  const { body } = await call<{ coverUrl: string }>(`/api/shops/${enc(shopId)}/cover`, { method: 'POST', body: photoForm(file) });
  return body.coverUrl;
}

/** Removes the shop's cover photo. */
export async function removeCover(shopId: string): Promise<void> {
  await call(`/api/shops/${enc(shopId)}/cover`, { method: 'DELETE' });
}
