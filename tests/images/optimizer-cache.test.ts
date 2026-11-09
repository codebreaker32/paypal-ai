// A deleted photo must not live on as a resized copy in Next's image optimizer cache. These tests write entries with
// Next's own cache class and etag function, so a Next upgrade that moves the file layout fails here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getImageEtag } from 'next/dist/server/image-optimizer/extract-etag';
import { ImageOptimizerCache } from 'next/dist/server/image-optimizer';
import { imageCacheDirs, removeWithOptimizedCopies } from '@/lib/images/optimizer-cache';

let root: string;
let distDir: string;
let cacheDir: string;

function realCache() {
  return new ImageOptimizerCache({
    distDir,
    nextConfig: { images: { minimumCacheTTL: 14400 }, experimental: { isrFlushToDisk: true } } as never,
  });
}

async function cachedCopy(original: Buffer, key: string, width: number): Promise<string> {
  const cacheKey = ImageOptimizerCache.getCacheKey({ href: key, width, quality: 75, mimeType: 'image/webp' });
  await realCache().set(
    cacheKey,
    { kind: 'IMAGE', etag: 'copy', buffer: Buffer.from('resized'), extension: 'webp', upstreamEtag: getImageEtag(original) } as never,
    { cacheControl: { revalidate: 31536000, expire: undefined } },
  );
  return cacheKey;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-optimizer-'));
  distDir = path.join(root, '.next');
  cacheDir = path.join(distDir, 'cache', 'images');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('removeWithOptimizedCopies', () => {
  it('removes the file and every resized copy of it, at any width or address, and leaves other photos', async () => {
    const mine = Buffer.from('my photo bytes');
    const other = Buffer.from('someone else');
    const file = path.join(root, 'img_a.webp');
    fs.writeFileSync(file, mine);
    const a = await cachedCopy(mine, '/i/img_a.webp', 640);
    const b = await cachedCopy(mine, '/i/img_a.webp', 256);
    const c = await cachedCopy(mine, '/i/img%5Fa.webp', 256);
    const keep = await cachedCopy(other, '/i/img_b.webp', 640);

    await removeWithOptimizedCopies([file], [cacheDir]);

    expect(fs.existsSync(file)).toBe(false);
    for (const gone of [a, b, c]) expect(await realCache().get(gone)).toBeNull();
    expect(await realCache().get(keep)).not.toBeNull();
    expect(fs.readdirSync(cacheDir)).toEqual([keep]);
  });

  it('removes a folder as well, and looks inside no other cache entry', async () => {
    const dir = path.join(root, 'shop_1');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'page-1.jpg'), 'menu');
    const keep = await cachedCopy(Buffer.from('other'), '/i/img_b.webp', 640);

    await removeWithOptimizedCopies([dir], [cacheDir]);

    expect(fs.existsSync(dir)).toBe(false);
    expect(fs.readdirSync(cacheDir)).toEqual([keep]);
  });

  it('never throws: no cache folder, a file already gone, a stray file in the cache', async () => {
    await expect(removeWithOptimizedCopies([path.join(root, 'nope.webp')], [cacheDir])).resolves.toBeUndefined();
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'stray'), 'x');
    const file = path.join(root, 'img_a.webp');
    fs.writeFileSync(file, 'x');
    await expect(removeWithOptimizedCopies([file], [cacheDir])).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(cacheDir, 'stray'))).toBe(true);
  });
});

describe('imageCacheDirs', () => {
  it('names the production and the dev build', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/app');
    expect(imageCacheDirs()).toEqual([path.join('/app', '.next', 'cache', 'images'), path.join('/app', '.next', 'dev', 'cache', 'images')]);
  });
});
