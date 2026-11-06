// Menu photos on disk (spec §5). Every upload is decoded by sharp, turned upright from its EXIF
// orientation, shrunk to at most 1600 px on the long edge and re-encoded as JPEG q85, so what we
// store and send to Claude is always a small, clean JPEG. The MIME type a browser sends is never
// trusted: if sharp can't decode the bytes as a photo, it is BAD_IMAGE. Item photos and shop covers
// (src/lib/catalog/photos.ts) go through the same decoder with their own size and format (WebP).
//
// Stored paths are relative to UPLOADS_DIR: "<shopId>/page-<n>.jpg". Use readUpload() to read one.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getConfig } from '@/lib/config';

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
/** The most one upload request may carry: every photo at the limit, plus 1 MB of form overhead. */
export const MAX_UPLOAD_BYTES = MAX_PHOTOS * MAX_PHOTO_BYTES + 1024 * 1024;
/** How a decoded photo is stored: shrunk to fit maxEdge on its long edge, then re-encoded (metadata dropped). */
export interface PhotoEncoding {
  maxEdge: number;
  format: 'jpeg' | 'webp';
  quality: number;
}
const MENU_PHOTO: PhotoEncoding = { maxEdge: 1600, format: 'jpeg', quality: 85 };
// Formats a phone or a photo picker produces. SVG, PDF and the like are refused.
const PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff', 'gif']);

export type UploadErrorCode = 'BAD_IMAGE' | 'PHOTO_TOO_LARGE' | 'TOO_MANY_PHOTOS' | 'NO_PHOTOS' | 'LENGTH_REQUIRED';

const STATUS: Record<UploadErrorCode, number> = {
  BAD_IMAGE: 415,
  PHOTO_TOO_LARGE: 413,
  TOO_MANY_PHOTOS: 400,
  NO_PHOTOS: 400,
  LENGTH_REQUIRED: 411,
};
const MESSAGES: Record<UploadErrorCode, string> = {
  BAD_IMAGE: "We couldn’t open that photo. Try a JPG or PNG.",
  PHOTO_TOO_LARGE: 'That photo is over 15 MB. Take it again or pick a smaller copy.',
  TOO_MANY_PHOTOS: `Shelfie reads up to ${MAX_PHOTOS} photos at a time.`,
  NO_PHOTOS: 'Add at least one photo of your price list.',
  LENGTH_REQUIRED: "We couldn’t tell how big that upload is. Try again from your browser.",
};

export class UploadError extends Error {
  readonly status: number;
  constructor(public readonly code: UploadErrorCode, message = MESSAGES[code]) {
    super(message);
    this.name = 'UploadError';
    this.status = STATUS[code];
  }
}

// The most pixels one photo may decode to: a 50 MP phone photo fits. A few hundred KB of PNG can
// claim far more, and decoding it would take hundreds of MB of memory (a decompression bomb).
export const MAX_PHOTO_PIXELS = 50 * 1024 * 1024;
const TOO_MANY_PIXELS = 'That photo is too big for us to read. Take it again at your camera’s normal size, or pick a smaller copy.';

// Photos are decoded one at a time across the whole process, so parallel uploads can't stack up memory.
let decoding: Promise<unknown> = Promise.resolve();

/**
 * Decodes, rotates, shrinks and re-encodes one photo (a menu photo, JPEG, unless told otherwise). Throws
 * UploadError('BAD_IMAGE') for anything else.
 */
export async function normalizePhoto(input: Buffer, encoding: PhotoEncoding = MENU_PHOTO): Promise<Buffer> {
  if (input.length > MAX_PHOTO_BYTES) throw new UploadError('PHOTO_TOO_LARGE');
  const run = decoding.then(() => decodePhoto(input, encoding));
  decoding = run.catch(() => undefined);
  return run;
}

async function decodePhoto(input: Buffer, { maxEdge, format, quality }: PhotoEncoding): Promise<Buffer> {
  try {
    // metadata() reads only the header, so the size check happens before any pixels are decoded.
    const meta = await sharp(input).metadata();
    if (!meta.format || !PHOTO_FORMATS.has(meta.format) || !meta.width || !meta.height) throw new UploadError('BAD_IMAGE');
    if (meta.width * meta.height > MAX_PHOTO_PIXELS) throw new UploadError('PHOTO_TOO_LARGE', TOO_MANY_PIXELS);
    // sharp writes no metadata (EXIF, GPS, ICC) unless asked to, so none of the phone's survives.
    const resized = sharp(input, { limitInputPixels: MAX_PHOTO_PIXELS })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
    return await (format === 'webp' ? resized.webp({ quality }) : resized.jpeg({ quality })).toBuffer();
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError('BAD_IMAGE');
  }
}

/**
 * Refuses an upload request whose Content-Length is over MAX_UPLOAD_BYTES, before any of the body is
 * read (req.formData() buffers it all). Browsers always send Content-Length for a form upload, so a
 * multipart body without one (chunked, of unknown size) is refused with LENGTH_REQUIRED (411).
 */
export function checkUploadSize(req: Request, maxBytes: number = MAX_UPLOAD_BYTES): void {
  const header = req.headers.get('content-length');
  const multipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
  if (multipart && (header === null || header.trim() === '' || !Number.isFinite(Number(header)))) {
    throw new UploadError('LENGTH_REQUIRED');
  }
  const declared = Number(header ?? 0);
  if (declared > maxBytes) {
    throw maxBytes === MAX_UPLOAD_BYTES
      ? new UploadError('PHOTO_TOO_LARGE', `Those photos are over ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB together. Send fewer, or smaller copies.`)
      : new UploadError('PHOTO_TOO_LARGE');
  }
}

/** The most a one-photo upload request (an item photo, a cover) may carry: one photo at the limit, plus 1 MB of form. */
export const MAX_ONE_PHOTO_UPLOAD_BYTES = MAX_PHOTO_BYTES + 1024 * 1024;
const CHOOSE_A_PHOTO = 'Choose a photo to upload.';

/**
 * The one photo in a multipart upload's `field`, read into memory. The request's size is checked from its
 * Content-Length before the body is read; a missing photo is NO_PHOTOS (400).
 */
export async function readOnePhoto(req: Request, field: string): Promise<Buffer> {
  checkUploadSize(req, MAX_ONE_PHOTO_UPLOAD_BYTES);
  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) throw new UploadError('NO_PHOTOS', CHOOSE_A_PHOTO);
  const form = await req.formData().catch(() => null);
  const file = form?.get(field);
  if (!file || typeof file === 'string') throw new UploadError('NO_PHOTOS', CHOOSE_A_PHOTO);
  return readFileLimited(file);
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

export async function readUpload(relPath: string): Promise<Buffer> {
  return fs.readFile(uploadFilePath(relPath));
}
