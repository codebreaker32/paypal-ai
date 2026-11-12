// No proxy or middleware stands in front of uploads, so a 14 MB menu photo reaches POST /api/shops whole.
// (The check that no proxy or middleware file exists is in tests/http/same-origin.test.ts; e2e/large-upload.spec.ts
// sends the same upload through a real server.)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
const { POST } = await import('@/app/api/shops/route');

const FOURTEEN_MB = 14 * 1024 * 1024;

let dir: string;
beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-large-'));
  process.env.UPLOADS_DIR = dir;
});
afterEach(() => {
  delete process.env.UPLOADS_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

it('reads all of a 14 MB multipart upload and starts the shop', async () => {
  const jpeg = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ddd' } }).jpeg().toBuffer();
  const photo = Buffer.concat([jpeg, Buffer.alloc(FOURTEEN_MB - jpeg.length, 0x20)]); // bytes after the image's end are ignored
  const form = new FormData();
  form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'menu.jpg');
  const encoded = new Response(form);
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  expect(bytes.byteLength).toBeGreaterThan(FOURTEEN_MB);

  let offset = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (offset >= bytes.byteLength) {
          controller.close();
          return;
        }
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        offset += chunk.byteLength;
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );

  const res = await POST(
    new Request('http://localhost/api/shops', {
      method: 'POST',
      headers: { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(bytes.byteLength) },
      body,
      duplex: 'half',
    } as RequestInit),
  );

  expect(res.status).toBe(201);
  expect(offset).toBe(bytes.byteLength);
  const { shopId } = (await res.json()) as { shopId: string };
  expect(shops.byId(state.db, shopId)!.menuPhotoPaths).toHaveLength(1);
});
