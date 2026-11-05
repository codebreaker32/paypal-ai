// POST /api/shops called with web Requests. next/headers' cookie jar and the app DB are swapped
// for in-memory ones; uploads go to a temp folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
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

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return { ...real, getDb: () => state.db };
});

const { createTestDb } = await import('@/lib/db');
const shops = await import('@/lib/db/repos/shops');
const { POST } = await import('@/app/api/shops/route');

async function jpeg(): Promise<Blob> {
  const buf = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#eee' } }).jpeg().toBuffer();
  return new Blob([new Uint8Array(buf)], { type: 'image/jpeg' });
}

/** A form upload as a browser sends it: serialised, with its Content-Length. */
async function multipart(files: { blob: Blob; name: string }[]): Promise<Request> {
  const form = new FormData();
  for (const f of files) form.append('photos', f.blob, f.name);
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  return new Request('http://localhost/api/shops', {
    method: 'POST',
    headers: { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(body.byteLength) },
    body,
  });
}

/** A multipart body streamed without a Content-Length (chunked); reading it would buffer an unbounded body. */
function chunkedMultipart(url: string, onRead: () => void): Request {
  const body = new ReadableStream(
    {
      pull() {
        onRead();
        throw new Error('the body must not be read');
      },
    },
    { highWaterMark: 0 },
  );
  return new Request(url, { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body, duplex: 'half' } as RequestInit);
}

const json = (body: unknown) =>
  new Request('http://localhost/api/shops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

describe('POST /api/shops', () => {
  let dir: string;
  beforeEach(() => {
    state.db = createTestDb();
    state.jar.clear();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-route-'));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a draft shop from photos, sets the owner cookie and answers 201', async () => {
    const res = await POST(await multipart([{ blob: await jpeg(), name: 'a.jpg' }, { blob: await jpeg(), name: 'b.jpg' }]));
    expect(res.status).toBe(201);
    const { shopId } = (await res.json()) as { shopId: string };
    const shop = shops.byId(state.db, shopId)!;
    expect(shop.menuPhotoPaths).toHaveLength(2);
    const token = state.jar.get(`shelfie_owner_${shopId}`);
    expect(shops.verifyOwnerToken(state.db, shopId, token)).toBe(true);
  });

  it('starts a shop without PayPal keys: only publishing needs them', async () => {
    const saved = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_SECRET_KEY };
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET_KEY;
    onTestFinished(() => {
      if (saved.id !== undefined) process.env.PAYPAL_CLIENT_ID = saved.id;
      if (saved.secret !== undefined) process.env.PAYPAL_SECRET_KEY = saved.secret;
    });
    const res = await POST(json({ sample: 'marigold-bakehouse' }));
    expect(res.status).toBe(201);
  });

  it('creates a shop from a sample menu', async () => {
    const res = await POST(json({ sample: 'tia-lupe-chalkboard' }));
    expect(res.status).toBe(201);
    const { shopId } = (await res.json()) as { shopId: string };
    expect(shops.byId(state.db, shopId)!.name).toBe('Tía Lupe’s Tacos');
  });

  it('rejects a request with no photos', async () => {
    const res = await POST(await multipart([]));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('NO_PHOTOS');
  });

  it('rejects five photos', async () => {
    const five = await Promise.all(Array.from({ length: 5 }, async (_, i) => ({ blob: await jpeg(), name: `${i}.jpg` })));
    const res = await POST(await multipart(five));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('TOO_MANY_PHOTOS');
    expect(state.db.prepare('select count(*) as n from shops').get()).toEqual({ n: 0 });
  });

  it('rejects a file that is not an image, even when it says it is', async () => {
    const fake = new Blob([new TextEncoder().encode('<html>not a photo</html>')], { type: 'image/jpeg' });
    const res = await POST(await multipart([{ blob: await jpeg(), name: 'ok.jpg' }, { blob: fake, name: 'menu.jpg' }]));
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe('BAD_IMAGE');
    // Nothing is created when any photo is bad.
    expect(state.db.prepare('select count(*) as n from shops').get()).toEqual({ n: 0 });
    expect(state.jar.size).toBe(0);
  });

  it('refuses an upload over 4 × 15 MB (+ 1 MB) from its Content-Length, before reading the body', async () => {
    const limit = 4 * 15 * 1024 * 1024 + 1024 * 1024;
    let read = false;
    // highWaterMark 0: pull() runs only when someone reads the body.
    const body = new ReadableStream(
      {
        pull() {
          read = true;
          throw new Error('the body must not be read');
        },
      },
      { highWaterMark: 0 },
    );
    const req = new Request('http://localhost/api/shops', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(limit + 1) },
      body,
      duplex: 'half',
    } as RequestInit);
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await errorCode(res)).toBe('PHOTO_TOO_LARGE');
    expect(read).toBe(false);
    expect(state.db.prepare('select count(*) as n from shops').get()).toEqual({ n: 0 });

    // At the limit the request is read as usual.
    const ok = await multipart([{ blob: await jpeg(), name: 'a.jpg' }]);
    expect((await POST(ok)).status).toBe(201);
  });

  it('refuses a multipart upload without a Content-Length with 411, before reading it', async () => {
    let read = false;
    const res = await POST(chunkedMultipart('http://localhost/api/shops', () => (read = true)));
    expect(res.status).toBe(411);
    expect(await res.json()).toEqual({ error: { code: 'LENGTH_REQUIRED', message: expect.any(String) } });
    expect(read).toBe(false);
    expect(state.db.prepare('select count(*) as n from shops').get()).toEqual({ n: 0 });
    // The JSON sample path needs no Content-Length.
    expect((await POST(json({ sample: 'marigold-bakehouse' }))).status).toBe(201);
  });

  it('rejects an unknown sample and a body that is neither', async () => {
    const res = await POST(json({ sample: 'nope' }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('UNKNOWN_SAMPLE');
    const plain = await POST(new Request('http://localhost/api/shops', { method: 'POST', body: 'hi' }));
    expect(plain.status).toBe(400);
    expect(await errorCode(plain)).toBe('NO_PHOTOS');
  });
});
