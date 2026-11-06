// POST /api/shops/[id]/counter: owner only, one photo, needs the Anthropic key, Claude failures are a plain 502.
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  propose: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));
vi.mock('@/lib/catalog/counter', async (orig) => ({
  ...(await orig<typeof import('@/lib/catalog/counter')>()),
  proposeCounterPhotos: (...args: unknown[]) => state.propose(...args),
}));

const { createTestDb } = await import('@/lib/db');
const { ownerCookieName } = await import('@/lib/auth/owner');
const { createShopFromSample } = await import('@/lib/catalog/setup');
const { resetRateLimits } = await import('@/lib/rate-limit');
const { UploadError } = await import('@/lib/uploads');
const route = await import('@/app/api/shops/[id]/counter/route');

async function upload(bytes: Buffer): Promise<Request> {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'case.jpg');
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const headers = { 'content-type': encoded.headers.get('content-type')!, 'content-length': String(body.byteLength) };
  return new Request('http://x', { method: 'POST', headers, body });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/shops/[id]/counter', () => {
  let shopId: string;
  let jpeg: Buffer;

  beforeEach(async () => {
    state.db = createTestDb();
    state.jar.clear();
    state.propose.mockReset();
    const created = await createShopFromSample(state.db, 'marigold-bakehouse');
    shopId = created.shop.id;
    state.jar.set(ownerCookieName(shopId), created.ownerToken);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRateLimits();
  });

  it('returns the proposals', async () => {
    state.propose.mockResolvedValue([{ itemId: 'itm_1', name: 'Almond croissant', confidence: 'high', image: 'data:image/webp;base64,AA' }]);
    const res = await route.POST(await upload(jpeg), ctx(shopId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ proposals: [{ itemId: 'itm_1', name: 'Almond croissant', confidence: 'high', image: 'data:image/webp;base64,AA' }] });
    expect(state.propose.mock.calls[0][1]).toBe(shopId);
  });

  it('is 404 for a browser that does not own the shop', async () => {
    state.jar.clear();
    const res = await route.POST(await upload(jpeg), ctx(shopId));
    expect(res.status).toBe(404);
    expect(state.propose).not.toHaveBeenCalled();
  });

  it('is 503 NO_AI_KEY without an Anthropic key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await route.POST(await upload(jpeg), ctx(shopId));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('NO_AI_KEY');
  });

  it('passes an upload error through (415 BAD_IMAGE)', async () => {
    state.propose.mockRejectedValue(new UploadError('BAD_IMAGE'));
    const res = await route.POST(await upload(jpeg), ctx(shopId));
    expect(res.status).toBe(415);
  });

  it('is a plain 502 COUNTER_FAILED when Claude fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.propose.mockRejectedValue(new Error('overloaded'));
    const res = await route.POST(await upload(jpeg), ctx(shopId));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('COUNTER_FAILED');
    expect(body.error.message).not.toMatch(/overloaded/);
    log.mockRestore();
  });
});
