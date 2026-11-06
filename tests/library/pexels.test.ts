// Part A3, optional: with PEXELS_API_KEY set, items with no photo and no pick get a live Pexels match, cached in
// library_cache and stored as `pexels:<id>`. Here the network is a fake fetch: nothing leaves the machine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import type { DraftItem } from '@/lib/domain/types';
import { fillLiveExamples, livePexelsPhoto, pexelsFromEnv, pexelsQuery, readPexelsFile, type PexelsDeps } from '@/lib/library/pexels';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-pexels-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const draft = (name: string, extra: Partial<DraftItem> = {}): DraftItem => ({
  section: null, name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL', issues: [], issueDetail: null,
  status: 'draft', variants: [{ label: null, priceCents: 400 }], ...extra,
});

const IMAGE = new Uint8Array([1, 2, 3]);

/** A fake Pexels: search answers from `results` by query; the image download returns IMAGE. */
function fakeFetch(results: Record<string, number | null>, calls: string[] = []) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.href);
    if (url.hostname === 'api.pexels.com') {
      expect((init?.headers as Record<string, string>).Authorization).toBe('test-key');
      const q = url.searchParams.get('query')!;
      const id = results[q] ?? null;
      const photos = id === null ? [] : [{ id, url: `https://www.pexels.com/photo/x-${id}/`, photographer: 'Ana', src: { large: `https://images.pexels.com/photos/${id}/large.jpeg` } }];
      return new Response(JSON.stringify({ photos }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.hostname === 'images.pexels.com') return new Response(IMAGE, { status: 200 });
    return new Response('no', { status: 404 });
  }) as typeof fetch;
}

const deps = (over: Partial<PexelsDeps> = {}): PexelsDeps => ({
  apiKey: 'test-key', dir, fetch: fakeFetch({}), encode: async (b) => Buffer.concat([Buffer.from('webp'), b]), timeoutMs: 1000, ...over,
});

describe('pexelsQuery', () => {
  it('is the item’s folded name, with a bicycle hint for bike parts and jobs', () => {
    expect(pexelsQuery({ name: 'Pain au Chocolat!', category: 'pastry' })).toBe('pain au chocolat');
    expect(pexelsQuery({ name: 'Flat fix', category: 'bike_part' })).toBe('flat fix bicycle');
    expect(pexelsQuery({ name: '  ', category: 'pastry' })).toBe('');
  });
});

describe('livePexelsPhoto', () => {
  it('searches, downloads, stores the WebP and caches the answer: a second ask makes no request', async () => {
    const db = createTestDb();
    const calls: string[] = [];
    const d = deps({ fetch: fakeFetch({ 'kouign amann': 777 }, calls) });
    expect(await livePexelsPhoto(db, 'kouign amann', d)).toBe('pexels:777');
    expect(fs.readFileSync(path.join(dir, 'pexels-777.webp')).subarray(0, 4).toString()).toBe('webp');
    expect(calls).toHaveLength(2);
    expect(await livePexelsPhoto(db, 'kouign amann', d)).toBe('pexels:777');
    expect(calls).toHaveLength(2);
    expect(db.prepare('SELECT pexels_id, file, photographer FROM library_cache WHERE query = ?').get('kouign amann')).toEqual({
      pexels_id: '777', file: 'pexels-777.webp', photographer: 'Ana',
    });
  });

  it('caches "nothing found" too', async () => {
    const db = createTestDb();
    const calls: string[] = [];
    const d = deps({ fetch: fakeFetch({}, calls) });
    expect(await livePexelsPhoto(db, 'zzz', d)).toBeNull();
    expect(await livePexelsPhoto(db, 'zzz', d)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('a failure or a timeout gives null and caches nothing (the bundled match stays)', async () => {
    const db = createTestDb();
    const down = (async () => new Response('err', { status: 500 })) as typeof fetch;
    expect(await livePexelsPhoto(db, 'scone', deps({ fetch: down }))).toBeNull();
    const hang = ((_: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    expect(await livePexelsPhoto(db, 'scone', deps({ fetch: hang, timeoutMs: 20 }))).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM library_cache').get()).toEqual({ n: 0 });
  });

  it('never trusts an id that is not a number', async () => {
    const db = createTestDb();
    const bad = (async () => new Response(JSON.stringify({ photos: [{ id: '../x', src: { large: 'https://images.pexels.com/a.jpg' } }] }))) as typeof fetch;
    expect(await livePexelsPhoto(db, 'scone', deps({ fetch: bad }))).toBeNull();
  });

  it('downloads only from Pexels’ image host', async () => {
    const db = createTestDb();
    const evil = (async () => new Response(JSON.stringify({ photos: [{ id: 5, src: { large: 'https://evil.example/a.jpg' } }] }))) as typeof fetch;
    expect(await livePexelsPhoto(db, 'scone', deps({ fetch: evil }))).toBeNull();
  });
});

describe('fillLiveExamples', () => {
  it('stores a live match only on items with no photo and no pick', async () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Rosa' });
    const [plain, picked, own] = items.replaceDrafts(db, shop.id, [
      draft('Kouign amann', { category: 'pastry' }),
      draft('Butter croissant', { examplePhoto: 'croissant-1' }),
      draft('Scone'),
    ]);
    items.update(db, own.id, { photoUrl: '/i/img_abcdefghijklmnopqrst.webp' });
    const calls: string[] = [];
    await fillLiveExamples(db, shop.id, deps({ fetch: fakeFetch({ 'kouign amann': 9, scone: 10, 'butter croissant': 11 }, calls) }));
    expect(items.byIdForShop(db, shop.id, plain.id)!.examplePhoto).toBe('pexels:9');
    expect(items.byIdForShop(db, shop.id, picked.id)!.examplePhoto).toBe('croissant-1');
    expect(items.byIdForShop(db, shop.id, own.id)!.examplePhoto).toBeNull();
    expect(calls.filter((c) => c.includes('api.pexels.com'))).toHaveLength(1);
  });

  it('never throws, even when the shop is gone', async () => {
    await expect(fillLiveExamples(createTestDb(), 'shp_nope', deps())).resolves.toBe(0);
  });
});

describe('readPexelsFile (GET /i/library/[file])', () => {
  it('serves a cached file by its exact name and nothing else', async () => {
    fs.writeFileSync(path.join(dir, 'pexels-42.webp'), 'x');
    expect((await readPexelsFile('pexels-42.webp', dir))?.toString()).toBe('x');
    expect(await readPexelsFile('../pexels-42.webp', dir)).toBeNull();
    expect(await readPexelsFile('pexels-42.jpg', dir)).toBeNull();
    expect(await readPexelsFile('pexels-43.webp', dir)).toBeNull();
  });
});

describe('pexelsFromEnv', () => {
  it('is off without PEXELS_API_KEY', () => {
    const before = process.env.PEXELS_API_KEY;
    delete process.env.PEXELS_API_KEY;
    expect(pexelsFromEnv()).toBeNull();
    process.env.PEXELS_API_KEY = 'k';
    expect(pexelsFromEnv()).toMatchObject({ apiKey: 'k' });
    if (before === undefined) delete process.env.PEXELS_API_KEY;
    else process.env.PEXELS_API_KEY = before;
  });
});
