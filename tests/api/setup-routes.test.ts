// The setup route handlers with web Requests: reading (POST/GET extract, retake upload), review edits
// (PATCH items, POST items, PATCH shop) and the publish NDJSON stream. Claude and PayPal are fakes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type Database from 'better-sqlite3';
import type { MenuExtraction } from '@/lib/ai/schemas';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  extract: null as unknown as (photos: unknown[]) => Promise<MenuExtraction>,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));
vi.mock('@/lib/ai/extract', () => ({ extractMenu: (photos: unknown[]) => state.extract(photos) }));

const { createTestDb } = await import('@/lib/db');
const shops = await import('@/lib/db/repos/shops');
const items = await import('@/lib/db/repos/items');
const extractions = await import('@/lib/db/repos/extractions');
const { createFakePayPal } = await import('@/lib/paypal/fake');
const { setPayPalForServices } = await import('@/lib/services');
const { recordedReading } = await import('@/lib/ai/samples');
const { ownerCookieName } = await import('@/lib/auth/owner');
const { createShopFromSample } = await import('@/lib/catalog/setup');
const { itemsToPublish } = await import('@/lib/catalog/publish');
const extractRoute = await import('@/app/api/shops/[id]/extract/route');
const itemsRoute = await import('@/app/api/shops/[id]/items/route');
const shopRoute = await import('@/app/api/shops/[id]/route');
const publishRoute = await import('@/app/api/shops/[id]/publish/route');

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonReq = (method: string, body: unknown) =>
  new Request('http://x', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function ndjson(res: Response): Promise<Record<string, unknown>[]> {
  return (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
}

describe('setup routes', () => {
  let dir: string;
  let shopId: string;
  let reads: number;

  beforeEach(async () => {
    state.db = createTestDb();
    state.jar.clear();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-routes-'));
    process.env.UPLOADS_DIR = dir;
    process.env.ANTHROPIC_API_KEY ||= 'test-key-not-used';
    reads = 0;
    state.extract = async () => {
      reads++;
      return recordedReading('marigold-bakehouse');
    };
    // Route handlers get PayPal from the composition root (src/lib/services.ts).
    setPayPalForServices(createFakePayPal());
    const created = await createShopFromSample(state.db, 'marigold-bakehouse');
    shopId = created.shop.id;
    state.jar.set(ownerCookieName(shopId), created.ownerToken);
  });
  afterEach(() => {
    setPayPalForServices(undefined);
    delete process.env.UPLOADS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('POST extract reads the menu once and returns the catalog; GET reports done', async () => {
    const res = await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { catalog: { items: unknown[]; needsAttention: number } };
    expect(body.catalog.items).toHaveLength(10);
    expect(body.catalog.needsAttention).toBe(4);
    expect(reads).toBe(1);
    const status = await extractRoute.GET(new Request('http://x'), ctx(shopId));
    expect(await status.json()).toEqual({ status: 'done' });
  });

  it('answers 202 while a reading is already running, without starting another', async () => {
    extractions.start(state.db, shopId, 'claude-sonnet-5-5');
    const res = await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.status).toBe(202);
    expect(reads).toBe(0);
    expect(await (await extractRoute.GET(new Request('http://x'), ctx(shopId))).json()).toEqual({ status: 'running' });
  });

  it('a retake uploads new photos, then reads them', async () => {
    const jpeg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const form = new FormData();
    form.append('photos', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'retake.jpg');
    form.append('mode', 'replace');
    let seen = 0;
    state.extract = async (photos) => {
      seen = photos.length;
      return recordedReading('marigold-bakehouse');
    };
    const encoded = new Response(form);
    const body = new Uint8Array(await encoded.arrayBuffer());
    const headers = { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(body.byteLength) };
    const res = await extractRoute.POST(new Request('http://x', { method: 'POST', headers, body }), ctx(shopId));
    expect(res.status).toBe(200);
    expect(seen).toBe(1);
    expect(shops.byId(state.db, shopId)!.menuPhotoPaths[0]).toMatch(/\/page-1-[a-z0-9]+\.jpg$/);
  });

  it('a retake over 4 × 15 MB (+ 1 MB) is refused from its Content-Length, before reading', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(4 * 15 * 1024 * 1024 + 1024 * 1024 + 1) },
      body: 'not read',
    });
    const res = await extractRoute.POST(req, ctx(shopId));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PHOTO_TOO_LARGE');
    expect(reads).toBe(0);
  });

  it('a retake without a Content-Length is refused with 411, before reading', async () => {
    let read = false;
    const body = new ReadableStream(
      {
        pull() {
          read = true;
          throw new Error('the body must not be read');
        },
      },
      { highWaterMark: 0 },
    );
    const req = new Request('http://x', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body, duplex: 'half' } as RequestInit);
    const res = await extractRoute.POST(req, ctx(shopId));
    expect(res.status).toBe(411);
    expect(await res.json()).toEqual({ error: { code: 'LENGTH_REQUIRED', message: expect.any(String) } });
    expect(read).toBe(false);
    expect(reads).toBe(0);
  });

  it('a failed reading is a 502 with a friendly message', async () => {
    state.extract = async () => {
      throw new Error('529 overloaded');
    };
    const res = await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('READING_FAILED');
    expect(body.error.message).not.toMatch(/529/);
  });

  it('PATCH items, POST items and PATCH shop edit the draft; bad input is a 400', async () => {
    await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    const focaccia = items.listWithVariants(state.db, shopId).find((i) => i.name.startsWith('Focaccia'))!;
    const patched = await itemsRoute.PATCH(jsonReq('PATCH', { updates: [{ itemId: focaccia.id, resolveIssues: true }] }), ctx(shopId));
    expect(patched.status).toBe(200);
    const { items: menu } = (await patched.json()) as { items: { id: string; issues: string[] }[] };
    expect(menu).toHaveLength(10);
    expect(menu.find((i) => i.id === focaccia.id)!.issues).toEqual([]);

    const bad = await itemsRoute.PATCH(jsonReq('PATCH', { updates: [{ itemId: focaccia.id, variants: [{ label: null, priceCents: 4.5 }] }] }), ctx(shopId));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');

    const added = await itemsRoute.POST(jsonReq('POST', { name: 'Add jam', priceCents: 150, sourceText: '+$1.5 add jam' }), ctx(shopId));
    expect(added.status).toBe(201);

    const shop = await shopRoute.PATCH(jsonReq('PATCH', { fulfillment: 'both', shippingFeeCents: 800 }), ctx(shopId));
    expect(((await shop.json()) as { shop: { fulfillment: string; shippingFeeCents: number } }).shop).toMatchObject({ fulfillment: 'both', shippingFeeCents: 800 });
  });

  it('publish streams start, one line per item and done, and makes the shop live', async () => {
    await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    const res = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const events = await ndjson(res);
    expect(events[0]).toMatchObject({ type: 'start' });
    expect((events[0].items as unknown[]).length).toBe(6);
    expect(events.filter((e) => e.type === 'item')).toHaveLength(6);
    expect(events.at(-1)).toMatchObject({ type: 'done', published: 6, failed: [], shop: { status: 'live', slug: 'marigold-bakehouse' } });

    // Nothing left: a second publish is a 400, not an empty stream.
    const again = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(again.status).toBe(400);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe('NOTHING_TO_PUBLISH');
  });

  it('keeps publishing and makes the shop live when the browser drops the stream mid-run', async () => {
    await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    const fake = createFakePayPal();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    setPayPalForServices({
      ...fake,
      async createProduct(p: Parameters<typeof fake.createProduct>[0], requestId: string) {
        await gate;
        return fake.createProduct(p, requestId);
      },
    });
    const res = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(JSON.parse(first.split('\n')[0])).toMatchObject({ type: 'start' });
    await reader.cancel(); // the seller closed the tab
    release();

    await vi.waitFor(() => expect(shops.byId(state.db, shopId)!.status).toBe('live'));
    expect(items.listWithVariants(state.db, shopId, { status: ['live'] })).toHaveLength(6);
    expect(fake.calls.filter((c) => c.method === 'createProduct')).toHaveLength(6);
    // The run is over: a new POST is not refused as "already running".
    await vi.waitFor(async () => {
      const again = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
      expect(((await again.json()) as { error: { code: string } }).error.code).toBe('NOTHING_TO_PUBLISH');
    });
  });

  it('a re-POST finishes a run that broke after every item reached PayPal', async () => {
    await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    // The broken run: items are in PayPal, the shop never went live.
    for (const it of itemsToPublish(state.db, shopId)) items.setPayPalProductId(state.db, it.id, `PROD-${it.id}`);
    expect(shops.byId(state.db, shopId)!.status).toBe('draft');

    const fake = createFakePayPal();
    setPayPalForServices(fake);
    const res = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.status).toBe(200);
    const events = await ndjson(res);
    expect(events[0]).toEqual({ type: 'start', items: [] });
    expect(events.at(-1)).toMatchObject({ type: 'done', published: 0, failed: [], shop: { status: 'live', slug: 'marigold-bakehouse' } });
    expect(fake.calls).toHaveLength(0);
  });

  it('publish is a 503 that names the missing keys when PayPal is not configured', async () => {
    await extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    setPayPalForServices(undefined);
    const saved = process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_ID;
    onTestFinished(() => {
      if (saved !== undefined) process.env.PAYPAL_CLIENT_ID = saved;
    });
    const res = await publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('PAYPAL_NOT_CONFIGURED');
    expect(body.error.message).toContain('PAYPAL_CLIENT_ID');
    expect(shops.byId(state.db, shopId)!.status).toBe('draft');
  });

  it('every setup route is a 404 for a browser that does not own the shop', async () => {
    state.jar.clear();
    const calls = [
      extractRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId)),
      extractRoute.GET(new Request('http://x'), ctx(shopId)),
      itemsRoute.PATCH(jsonReq('PATCH', { updates: [] }), ctx(shopId)),
      itemsRoute.POST(jsonReq('POST', {}), ctx(shopId)),
      shopRoute.PATCH(jsonReq('PATCH', {}), ctx(shopId)),
      publishRoute.POST(new Request('http://x', { method: 'POST' }), ctx(shopId)),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(404);
    expect(reads).toBe(0);
  });
});
