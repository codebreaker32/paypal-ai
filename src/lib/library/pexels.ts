// Part A3, optional: a live Pexels search for an item's example photo, used only when PEXELS_API_KEY is set (server
// side; the key never reaches a browser). After a menu reading, each item with no photo of its own and no pick from
// Claude is searched by name in the background; a hit is downloaded once, stored as WebP at
// `${UPLOADS_DIR}/library/pexels-<id>.webp` (served by GET /i/library/[file]) and the item keeps `pexels:<id>`.
// Every answer, "nothing found" included, is cached in library_cache by query. It never blocks the reading: any
// failure or timeout leaves the item on its bundled match (`exampleUrls`).
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import type { ItemCategory } from '@/lib/domain/category';
import { normalizePhoto } from '@/lib/uploads';
import { pexelsFileName } from './match';

/** The only file names GET /i/library/[file] serves. */
export const PEXELS_FILE = /^pexels-\d{1,20}\.webp$/;
const SEARCH = 'https://api.pexels.com/v1/search';
const IMAGE_HOST = 'images.pexels.com';
/** At most this many searches per reading (Pexels allows 200 an hour). */
const MAX_PER_READING = 30;

export interface PexelsDeps {
  apiKey: string;
  /** Where the WebP files go (`${UPLOADS_DIR}/library`). */
  dir: string;
  fetch?: typeof fetch;
  /** Per request. */
  timeoutMs?: number;
  /** The downloaded JPEG to the stored WebP (default: the upload decoder, 800 px, q80). */
  encode?: (input: Buffer) => Promise<Buffer>;
}

/** The directory the cached files live in. */
export const pexelsDir = () => path.resolve(getConfig().uploadsDir, 'library');

/** The deps from the environment, or null when PEXELS_API_KEY is not set (the feature is off). */
export function pexelsFromEnv(): PexelsDeps | null {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  return apiKey ? { apiKey, dir: pexelsDir() } : null;
}

const HINT: Partial<Record<ItemCategory, string>> = { bike_part: 'bicycle', tool: 'bicycle' };

/** The search words for an item: its name folded (lower case, accents and punctuation dropped), plus a hint for bike work. */
export function pexelsQuery(item: { name: string; category?: ItemCategory | null }): string {
  const name = item.name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(' ');
  if (!name) return '';
  const hint = item.category ? HINT[item.category] : undefined;
  return hint && !name.includes(hint) ? `${name} ${hint}` : name;
}

interface Hit { id: string; image: string; photographer: string | null; pageUrl: string | null }

async function search(query: string, deps: PexelsDeps): Promise<Hit | null> {
  const f = deps.fetch ?? fetch;
  const url = `${SEARCH}?${new URLSearchParams({ query, per_page: '1', orientation: 'landscape' })}`;
  const res = await f(url, { headers: { Authorization: deps.apiKey }, signal: AbortSignal.timeout(deps.timeoutMs ?? 4000) });
  if (!res.ok) throw new Error(`Pexels search ${res.status}`);
  const body = (await res.json()) as { photos?: { id?: unknown; url?: unknown; photographer?: unknown; src?: { large?: unknown } }[] };
  const p = body.photos?.[0];
  if (!p) return null;
  const id = String(p.id ?? '');
  if (!/^\d{1,20}$/.test(id)) throw new Error('Pexels id is not a number');
  const image = typeof p.src?.large === 'string' ? p.src.large : '';
  let host = '';
  try {
    const u = new URL(image);
    host = u.protocol === 'https:' ? u.hostname : '';
  } catch {
    /* host stays empty */
  }
  if (host !== IMAGE_HOST) throw new Error('Pexels image is not on the Pexels image host');
  return {
    id, image,
    photographer: typeof p.photographer === 'string' ? p.photographer.slice(0, 120) : null,
    pageUrl: typeof p.url === 'string' ? p.url.slice(0, 300) : null,
  };
}

/**
 * The live match for one query: `pexels:<id>`, or null (nothing found, or anything failed). Cached answers make no
 * request; a failure is not cached, so a later reading tries again.
 */
export async function livePexelsPhoto(db: Db, query: string, deps: PexelsDeps): Promise<string | null> {
  if (!query) return null;
  const cached = db.prepare('SELECT pexels_id FROM library_cache WHERE query = ?').get(query) as { pexels_id: string | null } | undefined;
  if (cached) return cached.pexels_id ? `pexels:${cached.pexels_id}` : null;
  try {
    const hit = await search(query, deps);
    const now = new Date().toISOString();
    const insert = db.prepare(
      'INSERT OR REPLACE INTO library_cache (query, pexels_id, file, photographer, page_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    if (!hit) {
      insert.run(query, null, null, null, null, now);
      return null;
    }
    const file = pexelsFileName(hit.id);
    const target = path.join(deps.dir, file);
    const exists = await fs.stat(target).then(() => true, () => false);
    if (!exists) {
      const res = await (deps.fetch ?? fetch)(hit.image, { signal: AbortSignal.timeout(deps.timeoutMs ?? 4000) });
      if (!res.ok) throw new Error(`Pexels image ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      const webp = await (deps.encode ?? ((b) => normalizePhoto(b, { maxEdge: 800, format: 'webp', quality: 80 })))(input);
      await fs.mkdir(deps.dir, { recursive: true });
      await fs.writeFile(target, webp);
    }
    insert.run(query, hit.id, file, hit.photographer, hit.pageUrl, now);
    return `pexels:${hit.id}`;
  } catch {
    return null;
  }
}

/**
 * Gives each of the shop's items with no photo and no pick a live match, one search at a time; returns how many it
 * set. Never throws. An item the seller changed meanwhile (a photo, a rename, a pick) is left alone.
 */
export async function fillLiveExamples(db: Db, shopId: string, deps: PexelsDeps): Promise<number> {
  let set = 0;
  try {
    const todo = itemsRepo
      .listWithVariants(db, shopId)
      .filter((i) => i.status !== 'removed' && !i.photoUrl && !i.examplePhoto)
      .slice(0, MAX_PER_READING);
    for (const item of todo) {
      const pick = await livePexelsPhoto(db, pexelsQuery(item), deps);
      if (!pick) continue;
      const now = itemsRepo.byIdForShop(db, shopId, item.id);
      if (!now || now.photoUrl || now.examplePhoto || now.name !== item.name) continue;
      itemsRepo.update(db, item.id, { examplePhoto: pick });
      set++;
    }
  } catch {
    /* the bundled match stays */
  }
  return set;
}

/** Starts the live search for a shop in the background when PEXELS_API_KEY is set; returns at once. */
export function startLiveExamples(db: Db, shopId: string): void {
  const deps = pexelsFromEnv();
  if (!deps) return;
  void fillLiveExamples(db, shopId, deps);
}

/** A cached file by name, or null for any name that isn't one (GET /i/library/[file]). */
export async function readPexelsFile(file: string, dir = pexelsDir()): Promise<Buffer | null> {
  return PEXELS_FILE.test(file) ? fs.readFile(path.join(dir, file)).catch(() => null) : null;
}
