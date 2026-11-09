// Item photos and shop covers a seller uploads (the photo-first storefront). Each upload goes through the menu
// upload's decoder (src/lib/uploads.ts: the 50 MP guard, one decode at a time, EXIF rotation, metadata dropped), is
// stored as WebP q80 at `${UPLOADS_DIR}/items/img_<random>.webp` and served by GET /i/[file]; the item or shop keeps
// the site-relative URL "/i/<file>". Replacing or clearing a photo deletes the uploaded file it replaces. Bundled
// demo photos ("/demo/…", in public/) are never deleted: only a URL of the exact /i/ form maps to a file here.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { newId } from '@/lib/domain/ids';
import { removeWithOptimizedCopies } from '@/lib/images/optimizer-cache';
import { normalizePhoto, type PhotoEncoding } from '@/lib/uploads';
import { EditError } from './edits';

export const ITEM_PHOTO: PhotoEncoding = { maxEdge: 1200, format: 'webp', quality: 80 };
export const COVER_PHOTO: PhotoEncoding = { maxEdge: 2000, format: 'webp', quality: 80 };
/** The shop's logo: its centre square, 512 px a side (the avatar is at most 96 px, so 2x and some). */
export const LOGO_PHOTO: PhotoEncoding = { maxEdge: 512, format: 'webp', quality: 85, square: true };

/** The only file names GET /i/[file] serves (and the only uploads this module ever deletes). */
export const UPLOADED_PHOTO_FILE = /^img_[a-z2-7]{20}\.webp$/;
const URL_PREFIX = '/i/';

function photosDir(): string {
  return path.resolve(getConfig().uploadsDir, 'items');
}

/** Absolute path of an uploaded photo by file name, or null for any name that isn't one of ours. */
export function uploadedPhotoPath(file: string): string | null {
  return UPLOADED_PHOTO_FILE.test(file) ? path.join(photosDir(), file) : null;
}

/** The file behind an "/i/<file>" URL, or null (no photo, a bundled /demo/ photo, anything else). */
export function uploadedPhotoFile(url: string | null): string | null {
  if (!url?.startsWith(URL_PREFIX)) return null;
  const file = url.slice(URL_PREFIX.length);
  return UPLOADED_PHOTO_FILE.test(file) ? file : null;
}

async function savePhoto(input: Buffer, encoding: PhotoEncoding): Promise<string> {
  const webp = await normalizePhoto(input, encoding);
  const file = `${newId('img', 20)}.webp`;
  const dir = photosDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), webp);
  return `${URL_PREFIX}${file}`;
}

/** Deletes the uploaded files behind these URLs and their resized copies; other URLs are left. Never throws. */
export async function deleteUploaded(...urls: (string | null)[]): Promise<void> {
  const paths = urls.flatMap((url) => {
    const file = uploadedPhotoFile(url);
    const abs = file && uploadedPhotoPath(file);
    return abs ? [abs] : [];
  });
  if (paths.length > 0) await removeWithOptimizedCopies(paths);
}

function itemOf(db: Db, shopId: string, itemId: string) {
  const item = itemsRepo.byIdForShop(db, shopId, itemId);
  if (!item) throw new EditError('ITEM_NOT_FOUND', 404, `No item ${itemId} in this shop.`);
  return item;
}

/**
 * Stores `input` as the item's photo (a draft on the review screen or a live item on the Menu tab) and returns its
 * URL. Throws EditError ITEM_NOT_FOUND (404) or UploadError (BAD_IMAGE 415, PHOTO_TOO_LARGE 413).
 */
export async function setItemPhoto(db: Db, shopId: string, itemId: string, input: Buffer): Promise<string> {
  itemOf(db, shopId, itemId);
  const url = await savePhoto(input, ITEM_PHOTO);
  // Read and swap with no await in between, so two uploads at once can't both keep (and orphan) the same old file.
  const previous = itemsRepo.byIdForShop(db, shopId, itemId);
  if (!previous) {
    await deleteUploaded(url);
    throw new EditError('ITEM_NOT_FOUND', 404, `No item ${itemId} in this shop.`);
  }
  itemsRepo.update(db, itemId, { photoUrl: url });
  await deleteUploaded(previous.photoUrl);
  return url;
}

/** Clears the item's photo (the designed fallback shows) and deletes the uploaded file. */
export async function clearItemPhoto(db: Db, shopId: string, itemId: string): Promise<void> {
  const item = itemOf(db, shopId, itemId);
  itemsRepo.update(db, itemId, { photoUrl: null });
  await deleteUploaded(item.photoUrl);
}

/** The shop's own pictures: the wide cover at the top of its page, and the square logo its avatar shows. */
export type ShopImage = 'cover' | 'logo';

const SHOP_IMAGES = {
  cover: { field: 'coverUrl', encoding: COVER_PHOTO },
  logo: { field: 'logoUrl', encoding: LOGO_PHOTO },
} as const satisfies Record<ShopImage, { field: 'coverUrl' | 'logoUrl'; encoding: PhotoEncoding }>;

/**
 * Stores `input` as the shop's cover (fitted to 2000 px) or logo (its centre square at 512 px) and returns its URL;
 * the upload it replaces is deleted. Throws UploadError like setItemPhoto, or EditError NOT_FOUND (404) when the shop
 * was deleted while this upload was on its way (its file would otherwise have no row to be found through).
 */
export async function setShopImage(db: Db, shopId: string, image: ShopImage, input: Buffer): Promise<string> {
  const { field, encoding } = SHOP_IMAGES[image];
  const url = await savePhoto(input, encoding);
  // Read and swap with no await in between, as for an item photo.
  const shop = shopsRepo.byId(db, shopId);
  if (!shop) {
    await deleteUploaded(url);
    throw new EditError('NOT_FOUND', 404, 'No such shop.');
  }
  shopsRepo.update(db, shopId, { [field]: url });
  await deleteUploaded(shop[field]);
  return url;
}

/** Clears the shop's cover or logo and deletes the uploaded file (the avatar falls back to its next picture). */
export async function clearShopImage(db: Db, shopId: string, image: ShopImage): Promise<void> {
  const { field } = SHOP_IMAGES[image];
  const previous = shopsRepo.byId(db, shopId)?.[field] ?? null;
  shopsRepo.update(db, shopId, { [field]: null });
  await deleteUploaded(previous);
}

/** An uploaded photo's bytes by file name, or null (not one of ours, or not on this server). */
export async function readUploadedPhoto(file: string): Promise<Buffer | null> {
  const abs = uploadedPhotoPath(file);
  return abs ? fs.readFile(abs).catch(() => null) : null;
}
