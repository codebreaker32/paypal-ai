import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, MAX_PHOTO_PIXELS, UploadError, decodePhotoPixels, normalizePhoto, readFileLimited, readUpload, writeUpload } from '@/lib/uploads';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 150, b: 90 } } });

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof UploadError ? e.code : `other: ${(e as Error).message}`;
  }
}

describe('uploads', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-uploads-'));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shrinks a large photo to 1600 px on the long edge and re-encodes it as JPEG', async () => {
    const png = await solid(3000, 2000).png().toBuffer();
    const out = await normalizePhoto(png);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([1600, 1067]);
  });

  it('never enlarges a small photo', async () => {
    const out = await normalizePhoto(await solid(400, 300).jpeg().toBuffer());
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it('turns a photo upright from its EXIF orientation', async () => {
    const sideways = await solid(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const meta = await sharp(await normalizePhoto(sideways)).metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
    expect(meta.orientation ?? 1).toBe(1);
  });

  it('rejects bytes that are not an image, whatever they claim to be', async () => {
    expect(await codeOf(normalizePhoto(Buffer.from('definitely not a jpeg')))).toBe('BAD_IMAGE');
  });

  it('rejects SVG and PDF even though sharp could open some of them', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    expect(await codeOf(normalizePhoto(svg))).toBe('BAD_IMAGE');
    expect(await codeOf(normalizePhoto(Buffer.from('%PDF-1.4\n%âãÏÓ\n')))).toBe('BAD_IMAGE');
  });

  it('rejects a photo over 15 MB before reading or decoding it', async () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    expect(await codeOf(readFileLimited(new Blob([big], { type: 'image/jpeg' })))).toBe('PHOTO_TOO_LARGE');
    expect(await codeOf(normalizePhoto(Buffer.from(big)))).toBe('PHOTO_TOO_LARGE');
    expect(await codeOf(readFileLimited(new Blob([])))).toBe('BAD_IMAGE');
  });

  it('refuses a small file that decodes to more pixels than a phone photo has (a decompression bomb)', async () => {
    const bomb = await solid(16_000, Math.ceil(MAX_PHOTO_PIXELS / 16_000) + 1).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(MAX_PHOTO_BYTES);
    expect(await codeOf(normalizePhoto(bomb))).toBe('PHOTO_TOO_LARGE');
  });

  it('still reads a 48 MP phone photo', async () => {
    const out = await normalizePhoto(await solid(8064, 6048).jpeg().toBuffer());
    expect((await sharp(out).metadata()).width).toBe(1600);
  });

  it('writes a normalised page under the shop folder and returns a path relative to UPLOADS_DIR', async () => {
    const file = new Blob([new Uint8Array(await solid(50, 80).png().toBuffer())], { type: 'image/png' });
    const rel = await writeUpload('shp_abc', 'page-2.jpg', await normalizePhoto(await readFileLimited(file)));
    expect(rel).toBe('shp_abc/page-2.jpg');
    expect(fs.existsSync(path.join(dir, 'shp_abc', 'page-2.jpg'))).toBe(true);
    const back = await readUpload(rel);
    expect((await sharp(back).metadata()).format).toBe('jpeg');
  });

  it('refuses to read outside the uploads folder', async () => {
    expect(await codeOf(readUpload('../../etc/passwd'))).toMatch(/other: /);
    await expect(readUpload('/etc/passwd')).rejects.toThrow();
  });
});

describe('decodePhotoPixels', () => {
  it('decodes once to raw pixels, upright and fitted to the long edge', async () => {
    // A 3000 × 1000 photo stored sideways (EXIF orientation 6) is 1000 × 3000 upright.
    const sideways = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#c8965a' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const raw = await decodePhotoPixels(sideways, 2000);
    expect([raw.width, raw.height]).toEqual([667, 2000]);
    expect(raw.data.length).toBe(raw.width * raw.height * raw.channels);
  });

  it('refuses a file that is not a photo', async () => {
    await expect(decodePhotoPixels(Buffer.from('nope'), 2000)).rejects.toMatchObject({ code: 'BAD_IMAGE' });
  });
});
