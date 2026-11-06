// Item photo and shop cover uploads (owner routes) and GET /i/[file], with web Requests and a temp UPLOADS_DIR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));

const { createTestDb } = await import('@/lib/db');
const shops = await import('@/lib/db/repos/shops');
const items = await import('@/lib/db/repos/items');
const { ownerCookieName } = await import('@/lib/auth/owner');
const { createShopFromSample } = await import('@/lib/catalog/setup');
const { MAX_ONE_PHOTO_UPLOAD_BYTES } = await import('@/lib/uploads');
const { resetRateLimits, SETUP_RATES } = await import('@/lib/rate-limit');
const itemPhotoRoute = await import('@/app/api/shops/[id]/items/[itemId]/photo/route');
const coverRoute = await import('@/app/api/shops/[id]/cover/route');
const fileRoute = await import('@/app/i/[file]/route');

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 150, b: 90 } } });

/** A multipart request with `bytes` as field `field`, with the Content-Length a browser sends. */
async function upload(bytes: Buffer, field = 'photo', extraHeaders: Record<string, string> = {}): Promise<Request> {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'photo.jpg');
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const headers = { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(body.byteLength), ...extraHeaders };
  return new Request('http://x', { method: 'POST', headers, body });
}

const itemCtx = (id: string, itemId: string) => ({ params: Promise.resolve({ id, itemId }) });
const shopCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const fileCtx = (file: string) => ({ params: Promise.resolve({ file }) });

describe('photo upload routes', () => {
  let dir: string;
  let shopId: string;
  let itemId: string;
  let jpeg: Buffer;
  const stored = (url: string) => path.join(dir, 'items', url.replace(/^\/i\//, ''));

  beforeEach(async () => {
    state.db = createTestDb();
    state.jar.clear();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-photos-'));
    process.env.UPLOADS_DIR = dir;
    const created = await createShopFromSample(state.db, 'marigold-bakehouse');
    shopId = created.shop.id;
    state.jar.set(ownerCookieName(shopId), created.ownerToken);
    itemId = items.insertDraft(state.db, shopId, {
      section: 'Pastries', name: 'Almond croissant', description: null, sourceText: 'Almond croissant 5', confidence: 'high',
      kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 500 }],
    }).id;
    jpeg = await solid(3000, 1500).jpeg().toBuffer();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRateLimits();
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('POST stores a draft item photo as a 1200 px WebP under /i/ and saves its URL', async () => {
    const res = await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId));
    expect(res.status).toBe(200);
    const { photoUrl } = (await res.json()) as { photoUrl: string };
    expect(photoUrl).toMatch(/^\/i\/img_[a-z2-7]{20}\.webp$/);
    expect(items.byIdForShop(state.db, shopId, itemId)!.photoUrl).toBe(photoUrl);
    const meta = await sharp(fs.readFileSync(stored(photoUrl))).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 1200, height: 600 });
  });

  it('turns a sideways phone photo upright and drops its metadata', async () => {
    const sideways = await solid(40, 30).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const res = await itemPhotoRoute.POST(await upload(sideways), itemCtx(shopId, itemId));
    const { photoUrl } = (await res.json()) as { photoUrl: string };
    const meta = await sharp(fs.readFileSync(stored(photoUrl))).metadata();
    expect(meta).toMatchObject({ width: 30, height: 40 });
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it('works on a live item too (the Menu tab)', async () => {
    items.update(state.db, itemId, { status: 'live' });
    const res = await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId));
    expect(res.status).toBe(200);
  });

  it('a new photo replaces the old one and deletes its file', async () => {
    const first = (await (await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId))).json()) as { photoUrl: string };
    const second = (await (await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId))).json()) as { photoUrl: string };
    expect(second.photoUrl).not.toBe(first.photoUrl);
    expect(fs.existsSync(stored(first.photoUrl))).toBe(false);
    expect(fs.existsSync(stored(second.photoUrl))).toBe(true);
  });

  it('never deletes a bundled demo photo or anything outside the uploaded photos', async () => {
    const outside = path.join(dir, 'keep.webp');
    fs.writeFileSync(outside, 'x');
    for (const old of ['/demo/marigold-bakehouse/almond-croissant.jpg', '/i/../keep.webp', '/i/img_aaaaaaaaaaaaaaaaaaaa.webp/../../keep.webp']) {
      items.update(state.db, itemId, { photoUrl: old });
      const res = await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId));
      expect(res.status).toBe(200);
      expect(fs.existsSync(outside)).toBe(true);
    }
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'samples', 'marigold-bakehouse.jpg'))).toBe(true);
  });

  it('DELETE clears the photo and deletes the uploaded file', async () => {
    const { photoUrl } = (await (await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId))).json()) as { photoUrl: string };
    const res = await itemPhotoRoute.DELETE(new Request('http://x', { method: 'DELETE' }), itemCtx(shopId, itemId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photoUrl: null });
    expect(items.byIdForShop(state.db, shopId, itemId)!.photoUrl).toBeNull();
    expect(fs.existsSync(stored(photoUrl))).toBe(false);
  });

  it('DELETE on a demo photo just clears it', async () => {
    items.update(state.db, itemId, { photoUrl: '/demo/marigold-bakehouse/almond-croissant.jpg' });
    const res = await itemPhotoRoute.DELETE(new Request('http://x', { method: 'DELETE' }), itemCtx(shopId, itemId));
    expect(res.status).toBe(200);
    expect(items.byIdForShop(state.db, shopId, itemId)!.photoUrl).toBeNull();
  });

  it('answers 404 to a browser that does not own the shop, and for an item of another shop', async () => {
    state.jar.clear();
    const res = await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId));
    expect(res.status).toBe(404);
    expect((await coverRoute.POST(await upload(jpeg), shopCtx(shopId))).status).toBe(404);
    expect((await coverRoute.DELETE(new Request('http://x', { method: 'DELETE' }), shopCtx(shopId))).status).toBe(404);
    expect((await itemPhotoRoute.DELETE(new Request('http://x', { method: 'DELETE' }), itemCtx(shopId, itemId))).status).toBe(404);
    expect(items.byIdForShop(state.db, shopId, itemId)!.photoUrl).toBeNull();

    const other = await createShopFromSample(state.db, 'ravi-bike-repair');
    state.jar.set(ownerCookieName(other.shop.id), other.ownerToken);
    const cross = await itemPhotoRoute.POST(await upload(jpeg), itemCtx(other.shop.id, itemId));
    expect(cross.status).toBe(404);
    expect(((await cross.json()) as { error: { code: string } }).error.code).toBe('ITEM_NOT_FOUND');
    expect(fs.existsSync(path.join(dir, 'items')) ? fs.readdirSync(path.join(dir, 'items')) : []).toEqual([]);
  });

  it('refuses something that is not a photo with plain copy, and a missing photo', async () => {
    const bad = await itemPhotoRoute.POST(await upload(Buffer.from('definitely not a jpeg')), itemCtx(shopId, itemId));
    expect(bad.status).toBe(415);
    expect(await bad.json()).toEqual({ error: { code: 'BAD_IMAGE', message: 'We couldn’t open that photo. Try a JPG or PNG.' } });
    const missing = await itemPhotoRoute.POST(await upload(jpeg, 'photos'), itemCtx(shopId, itemId));
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe('NO_PHOTOS');
    const json = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect((await itemPhotoRoute.POST(json, itemCtx(shopId, itemId))).status).toBe(400);
    expect(items.byIdForShop(state.db, shopId, itemId)!.photoUrl).toBeNull();
  });

  it('refuses an upload over one photo’s size from its Content-Length, before reading it', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(MAX_ONE_PHOTO_UPLOAD_BYTES + 1) },
      body: 'x',
    });
    const res = await itemPhotoRoute.POST(req, itemCtx(shopId, itemId));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PHOTO_TOO_LARGE');
  });

  it('limits photo uploads from one address per hour (SHELFIE_TEST skips it, like the setup limits)', async () => {
    vi.stubEnv('SHELFIE_TEST', '');
    resetRateLimits();
    const tiny = await solid(10, 10).jpeg().toBuffer();
    const ip = { 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < SETUP_RATES.photos.limit; i++) {
      // Spend the budget without decoding a photo each time: a missing photo is refused after the limit check.
      const res = await itemPhotoRoute.POST(await upload(tiny, 'other', ip), itemCtx(shopId, itemId));
      expect(res.status).toBe(400);
    }
    const over = await coverRoute.POST(await upload(tiny, 'photo', ip), shopCtx(shopId));
    expect(over.status).toBe(429);
    expect(((await over.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });

  it('cover: POST stores a 2000 px WebP and replaces (and deletes) the old one; DELETE clears it', async () => {
    const wide = await solid(2400, 1000).jpeg().toBuffer();
    const res = await coverRoute.POST(await upload(wide), shopCtx(shopId));
    expect(res.status).toBe(200);
    const { coverUrl } = (await res.json()) as { coverUrl: string };
    expect(coverUrl).toMatch(/^\/i\/img_[a-z2-7]{20}\.webp$/);
    expect(shops.byId(state.db, shopId)!.coverUrl).toBe(coverUrl);
    expect(await sharp(fs.readFileSync(stored(coverUrl))).metadata()).toMatchObject({ format: 'webp', width: 2000, height: 833 });

    const next = (await (await coverRoute.POST(await upload(wide), shopCtx(shopId))).json()) as { coverUrl: string };
    expect(fs.existsSync(stored(coverUrl))).toBe(false);

    expect(shops.byId(state.db, shopId)!.coverUrl).toBe(next.coverUrl);
    const cleared = await coverRoute.DELETE(new Request('http://x', { method: 'DELETE' }), shopCtx(shopId));
    expect(await cleared.json()).toEqual({ coverUrl: null });
    expect(shops.byId(state.db, shopId)!.coverUrl).toBeNull();
    expect(fs.existsSync(stored(next.coverUrl))).toBe(false);
  });

  it('cover: refuses a bad image without touching the current cover', async () => {
    shops.update(state.db, shopId, { coverUrl: '/demo/marigold-bakehouse/cover.jpg' });
    const res = await coverRoute.POST(await upload(Buffer.from('nope')), shopCtx(shopId));
    expect(res.status).toBe(415);
    expect(shops.byId(state.db, shopId)!.coverUrl).toBe('/demo/marigold-bakehouse/cover.jpg');
  });

  it('GET /i/[file] serves an uploaded photo as WebP, cached for a year', async () => {
    const { photoUrl } = (await (await itemPhotoRoute.POST(await upload(jpeg), itemCtx(shopId, itemId))).json()) as { photoUrl: string };
    const res = await fileRoute.GET(new Request(`http://x${photoUrl}`), fileCtx(photoUrl.slice(3)));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await res.arrayBuffer()).equals(fs.readFileSync(stored(photoUrl)))).toBe(true);
  });

  it('GET /i/[file] answers 404 for a missing file or any name that is not one of ours', async () => {
    fs.mkdirSync(path.join(dir, 'items'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'items', 'notes.txt'), 'x');
    fs.writeFileSync(path.join(dir, 'secret.webp'), 'x');
    for (const name of ['img_aaaaaaaaaaaaaaaaaaaa.webp', 'notes.txt', '../secret.webp', '..%2Fsecret.webp', 'img_AAAAAAAAAAAAAAAAAAAA.webp', '']) {
      const res = await fileRoute.GET(new Request('http://x/i/x'), fileCtx(name));
      expect(res.status, name).toBe(404);
    }
  });
});
