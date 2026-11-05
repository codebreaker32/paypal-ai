// Menu photos on disk (spec §5). Every upload is decoded by sharp, turned upright from its EXIF
// orientation, shrunk to at most 1600 px on the long edge and re-encoded as JPEG q85, so what we
// store and send to Claude is always a small, clean JPEG. The MIME type a browser sends is never
// trusted: if sharp can't decode the bytes as a photo, it is BAD_IMAGE.
//
// Stored paths are relative to UPLOADS_DIR: "<shopId>/page-<n>.jpg". Use readUpload() to read one.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getConfig } from '@/lib/config';

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;
// Formats a phone or a photo picker produces. SVG, PDF and the like are refused.
const PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff', 'gif']);

export type UploadErrorCode = 'BAD_IMAGE' | 'PHOTO_TOO_LARGE' | 'TOO_MANY_PHOTOS' | 'NO_PHOTOS';

const STATUS: Record<UploadErrorCode, number> = { BAD_IMAGE: 415, PHOTO_TOO_LARGE: 413, TOO_MANY_PHOTOS: 400, NO_PHOTOS: 400 };
const MESSAGES: Record<UploadErrorCode, string> = {
  BAD_IMAGE: "We couldn't open that photo. Try a JPG or PNG.",
  PHOTO_TOO_LARGE: 'That photo is over 15 MB. Take it again or pick a smaller copy.',
  TOO_MANY_PHOTOS: `Shelfie reads up to ${MAX_PHOTOS} photos at a time.`,
  NO_PHOTOS: 'Add at least one photo of your price list.',
};

export class UploadError extends Error {
  readonly status: number;
  constructor(public readonly code: UploadErrorCode, message = MESSAGES[code]) {
    super(message);
    this.name = 'UploadError';
    this.status = STATUS[code];
  }
}

/** Decodes, rotates, shrinks and re-encodes one photo. Throws UploadError('BAD_IMAGE') for anything else. */
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_PHOTO_BYTES) throw new UploadError('PHOTO_TOO_LARGE');
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !PHOTO_FORMATS.has(meta.format) || !meta.width || !meta.height) throw new UploadError('BAD_IMAGE');
    return await sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError('BAD_IMAGE');
  }
}

/** Reads a browser upload into memory, refusing anything over the size limit before reading it. */
export async function readFileLimited(file: Blob): Promise<Buffer> {
  if (file.size > MAX_PHOTO_BYTES) throw new UploadError('PHOTO_TOO_LARGE');
  if (file.size === 0) throw new UploadError('BAD_IMAGE');
  return Buffer.from(await file.arrayBuffer());
}

function uploadsRoot(): string {
  return path.resolve(getConfig().uploadsDir);
}

/** Absolute path of a stored upload; throws if the path would leave UPLOADS_DIR. */
export function uploadFilePath(relPath: string): string {
  const root = uploadsRoot();
  const abs = path.resolve(root, relPath);
  if (path.isAbsolute(relPath) || !abs.startsWith(root + path.sep)) throw new Error('Invalid upload path');
  return abs;
}

/** Writes an already-normalised JPEG as `<shopId>/<name>` and returns its stored path. */
export async function writeUpload(shopId: string, name: string, jpeg: Buffer): Promise<string> {
  const rel = `${shopId}/${name}`;
  const abs = uploadFilePath(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, jpeg);
  return rel;
}

/** Normalises one uploaded photo and saves it as page n of the shop's menu. Returns the stored path. */
export async function saveUpload(shopId: string, file: Blob | Buffer, page: number): Promise<string> {
  const bytes = Buffer.isBuffer(file) ? file : await readFileLimited(file);
  return writeUpload(shopId, `page-${page}.jpg`, await normalizePhoto(bytes));
}

export async function readUpload(relPath: string): Promise<Buffer> {
  return fs.readFile(uploadFilePath(relPath));
}
