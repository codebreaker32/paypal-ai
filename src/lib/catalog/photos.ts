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

/** Deletes the uploaded file behind a replaced URL. Never throws: a stale file is only disk space. */
async function deleteUploaded(url: string | null): Promise<void> {
  const file = uploadedPhotoFile(url);
  const abs = file && uploadedPhotoPath(file);
  if (abs) await fs.rm(abs, { force: true }).catch(() => undefined);
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

/** Stores `input` as the shop's cover photo and returns its URL. Throws UploadError like setItemPhoto. */
export async function setShopCover(db: Db, shopId: string, input: Buffer): Promise<string> {
  const url = await savePhoto(input, COVER_PHOTO);
  const previous = shopsRepo.byId(db, shopId)?.coverUrl ?? null;
  shopsRepo.update(db, shopId, { coverUrl: url });
  await deleteUploaded(previous);
  return url;
}

/** Clears the shop's cover photo and deletes the uploaded file. */
export async function clearShopCover(db: Db, shopId: string): Promise<void> {
  const previous = shopsRepo.byId(db, shopId)?.coverUrl ?? null;
  shopsRepo.update(db, shopId, { coverUrl: null });
  await deleteUploaded(previous);
}

/** Stores `input` as the shop's logo (a centred square) and returns its URL. Throws UploadError like setItemPhoto. */
export async function setShopLogo(db: Db, shopId: string, input: Buffer): Promise<string> {
  const url = await savePhoto(input, LOGO_PHOTO);
  const previous = shopsRepo.byId(db, shopId)?.logoUrl ?? null;
  shopsRepo.update(db, shopId, { logoUrl: url });
  await deleteUploaded(previous);
  return url;
}

/** Clears the shop's logo (the avatar falls back to the cover, a menu photo or a drawing) and deletes the file. */
export async function clearShopLogo(db: Db, shopId: string): Promise<void> {
  const previous = shopsRepo.byId(db, shopId)?.logoUrl ?? null;
  shopsRepo.update(db, shopId, { logoUrl: null });
  await deleteUploaded(previous);
}

/** An uploaded photo's bytes by file name, or null (not one of ours, or not on this server). */
export async function readUploadedPhoto(file: string): Promise<Buffer | null> {
  const abs = uploadedPhotoPath(file);
  return abs ? fs.readFile(abs).catch(() => null) : null;
}
