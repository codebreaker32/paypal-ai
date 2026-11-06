// The seller's setup journey on the server: create a draft shop from photos or a sample, read the
// menu with Claude (or a recorded reading for samples without a key), and work out which step the
// setup page should show. Route handlers and the page stay thin; this module holds the rules.
import fs from 'node:fs/promises';
import type { Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import * as extractions from '@/lib/db/repos/extractions';
import { newId } from '@/lib/domain/ids';
import type { DraftCatalog, ItemWithVariants, Shop, SkippedLine, UnreadableReason } from '@/lib/domain/types';
import { MODEL_ID } from '@/lib/ai/anthropic';
import type { MenuPhoto } from '@/lib/ai/extract';
import { normalizeExtraction } from '@/lib/ai/normalize';
import { MenuExtractionSchema, type MenuExtraction } from '@/lib/ai/schemas';
import { SAMPLE_IDS, SAMPLES, recordedReading, samplePhotoPath, type SampleId } from '@/lib/ai/samples';
import { MAX_PHOTOS, UploadError, normalizePhoto, readUpload, writeUpload } from '@/lib/uploads';

/** Shown until the menu (or the seller) gives the shop a name. */
export const PLACEHOLDER_NAME = 'My shop';
/**
 * A reading still "running" after this long died with its process: it counts as failed. A live
 * reading can take up to 90 s, plus one 90 s retry when Claude's first answer doesn't parse
 * (src/lib/ai/extract.ts), so this leaves a minute to spare.
 */
export const READING_STALE_MS = 4 * 60_000;
export const RECORDED_PREFIX = 'recorded:';

// ───────────── Creating the draft shop ─────────────

/** A new draft shop and its raw owner token (returned once; only its hash is stored). */
export interface CreatedShop {
  shop: Shop;
  ownerToken: string;
}

/** A shop starts with a throwaway slug; publishShop gives it the real one from its final name. */
async function createDraftShop(
  db: Db,
  name: string,
  savePhotos: (shopId: string) => Promise<string[]>,
): Promise<CreatedShop> {
  const { shop, ownerToken } = shops.create(db, { name: `draft ${newId('shp', 8).slice(4)}` });
  const menuPhotoPaths = await savePhotos(shop.id);
  return { shop: shops.update(db, shop.id, { name, menuPhotoPaths }), ownerToken };
}

/** `photos` are raw uploads; each is normalised (and rejected if it isn't a photo) before the shop exists. */
export async function createShopFromPhotos(db: Db, photos: Buffer[]): Promise<CreatedShop> {
  const jpegs = await Promise.all(photos.map(normalizePhoto));
  return createDraftShop(db, PLACEHOLDER_NAME, (id) =>
    Promise.all(jpegs.map((jpeg, i) => writeUpload(id, `page-${i + 1}.jpg`, jpeg))),
  );
}

/** The sample's photo is copied into the shop's folder; its file name remembers which sample it was. */
export async function createShopFromSample(db: Db, sample: SampleId): Promise<CreatedShop> {
  const jpeg = await normalizePhoto(await fs.readFile(samplePhotoPath(sample)));
  return createDraftShop(db, SAMPLES[sample].name, async (id) => [await writeUpload(id, `sample-${sample}.jpg`, jpeg)]);
}

/**
 * New photos for a draft shop whose menu couldn't be read: "replace" swaps them all (a retake),
 * "add" appends pages (a cropped menu). Every photo is checked before anything is saved.
 */
export async function setShopPhotos(db: Db, shop: Shop, photos: Buffer[], mode: 'replace' | 'add'): Promise<Shop> {
  const kept = mode === 'add' ? shop.menuPhotoPaths : [];
  if (photos.length === 0) throw new UploadError('NO_PHOTOS');
  if (kept.length + photos.length > MAX_PHOTOS) throw new UploadError('TOO_MANY_PHOTOS');
  const jpegs = await Promise.all(photos.map(normalizePhoto));
  // A fresh name per upload, so a retaken page never collides with (or caches as) the old one.
  const stamp = Date.now().toString(36);
  const added = await Promise.all(
    jpegs.map((jpeg, i) => writeUpload(shop.id, `page-${kept.length + i + 1}-${stamp}.jpg`, jpeg)),
  );
  return shops.update(db, shop.id, { menuPhotoPaths: [...kept, ...added] });
}

export function sampleOf(shop: Pick<Shop, 'menuPhotoPaths'>): SampleId | null {
  const m = /\/sample-([a-z-]+)\.jpg$/.exec(shop.menuPhotoPaths[0] ?? '');
  return m && (SAMPLE_IDS as string[]).includes(m[1]) ? (m[1] as SampleId) : null;
}

// ───────────── Reading the menu ─────────────

export interface ReadingDeps {
  db: Db;
  extract: (photos: MenuPhoto[]) => Promise<MenuExtraction>;
  hasAiKey: boolean;
  /** Sample menus use their recorded reading even with a key (SHELFIE_RECORDED_SAMPLES=1, for demos). */
  recordedSamples?: boolean;
  readPhoto?: (relPath: string) => Promise<Buffer>;
  now?: () => number;
  /** A short pause so a recorded reading still shows the reading screen. */
  recordedDelayMs?: number;
}

export type ReadingOutcome =
  | { status: 'running' }
  | { status: 'done'; catalog: DraftCatalog }
  | { status: 'unreadable'; reason: UnreadableReason; tip: string }
  | { status: 'failed'; message: string };

// Stored in extractions.error as "<CODE>: <detail>"; only the code reaches the seller.
type FailCode = 'NO_AI_KEY' | 'TIMEOUT' | 'AI_ERROR' | 'NO_PHOTOS';

const FRIENDLY: Record<FailCode | 'STALE', string> = {
  NO_AI_KEY:
    'Reading your own photo needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env and restart, or try a sample menu.',
  TIMEOUT: 'Reading took too long. Long menus sometimes do. Try again.',
  AI_ERROR: "We couldn’t finish reading your menu. Your photos are saved, so you can try again.",
  NO_PHOTOS: 'This shop has no photos to read. Start again with a photo of your price list.',
  STALE: "Reading stopped before it finished. Your photos are saved, so you can try again.",
};

function friendlyError(error: string | null): string {
  const code = /^([A-Z_]+):/.exec(error ?? '')?.[1] as FailCode | undefined;
  return (code && FRIENDLY[code]) || FRIENDLY.AI_ERROR;
}

function failCodeFor(err: unknown): FailCode {
  const msg = err instanceof Error ? err.message : String(err);
  return /timed? ?out|timeout|abort/i.test(msg) ? 'TIMEOUT' : 'AI_ERROR';
}

const isStale = (createdAt: string, now: number) => now - Date.parse(createdAt) > READING_STALE_MS;

/** Fills only the shop fields the seller hasn't written themselves. */
function applyShopDraft(db: Db, shop: Shop, c: DraftCatalog): void {
  shops.update(db, shop.id, {
    name: shop.name === PLACEHOLDER_NAME && c.shop.name ? c.shop.name : undefined,
    about: shop.about === '' && c.shop.about ? c.shop.about : undefined,
    pickupNotes: shop.pickupNotes === '' && c.shop.pickupNotes ? c.shop.pickupNotes : undefined,
    kind: c.kind,
  });
}

/**
 * Reads the shop's photos once. Safe to call again: a run already going returns "running", and a
 * run that has been going for over four minutes (READING_STALE_MS) is treated as dead and replaced.
 */
export async function runReading(deps: ReadingDeps, shopId: string): Promise<ReadingOutcome> {
  const { db } = deps;
  const now = deps.now ?? Date.now;
  const shop = shops.byId(db, shopId);
  if (!shop) throw new Error(`runReading: unknown shop ${shopId}`);
  if (shop.status !== 'draft') return { status: 'failed', message: 'This shop is already published.' };

  const last = extractions.latest(db, shopId);
  if (last?.status === 'running' && !isStale(last.createdAt, now())) return { status: 'running' };

  const sample = sampleOf(shop);
  const recorded = sample !== null && (!deps.hasAiKey || deps.recordedSamples === true);
  const started = now();
  const id = extractions.start(db, shopId, recorded ? `${RECORDED_PREFIX}${MODEL_ID}` : MODEL_ID);
  const fail = (code: FailCode, detail: string): ReadingOutcome => {
    extractions.fail(db, id, `${code}: ${detail}`);
    return { status: 'failed', message: FRIENDLY[code] };
  };

  if (!deps.hasAiKey && !sample) return fail('NO_AI_KEY', 'ANTHROPIC_API_KEY is not set');
  if (shop.menuPhotoPaths.length === 0) return fail('NO_PHOTOS', 'shop has no photos');

  let raw: MenuExtraction;
  try {
    if (recorded) {
      raw = recordedReading(sample);
      if (deps.recordedDelayMs) await new Promise((r) => setTimeout(r, deps.recordedDelayMs));
    } else {
      const read = deps.readPhoto ?? readUpload;
      const photos = await Promise.all(
        shop.menuPhotoPaths.map(async (p): Promise<MenuPhoto> => ({ data: await read(p), mediaType: 'image/jpeg' })),
      );
      raw = await deps.extract(photos);
    }
  } catch (err) {
    return fail(failCodeFor(err), err instanceof Error ? err.message : String(err));
  }

  const result = normalizeExtraction(raw);
  const durationMs = now() - started;
  if ('unreadable' in result) {
    extractions.finish(db, id, { raw, imageQuality: raw.image_quality, warnings: raw.warnings, skipped: [], durationMs });
    return { status: 'unreadable', reason: result.reason, tip: result.tip };
  }
  db.transaction(() => {
    extractions.finish(db, id, {
      raw, imageQuality: raw.image_quality, warnings: result.warnings, skipped: result.skipped, durationMs,
    });
    items.replaceDrafts(db, shopId, result.items);
    applyShopDraft(db, shop, result);
  })();
  return { status: 'done', catalog: result };
}

// ───────────── Which step the setup page shows ─────────────

export interface ReviewShop {
  id: string;
  name: string;
  about: string;
  pickupNotes: string;
  fulfillment: Shop['fulfillment'];
  shippingFeeCents: number;
  kind: Shop['kind'];
}

interface Base {
  shopId: string;
  photoCount: number;
}

export type SetupView =
  | (Base & { step: 'reading'; running: boolean; recorded: boolean })
  | (Base & { step: 'failed'; message: string })
  | (Base & { step: 'unreadable'; reason: UnreadableReason; tip: string })
  | (Base & {
      step: 'review';
      shop: ReviewShop;
      items: ItemWithVariants[];
      skipped: SkippedLine[];
      warnings: string[];
      nonUsd: boolean;
      recorded: boolean;
    })
  | (Base & { step: 'live'; shop: Shop });

export function loadSetupView(db: Db, shop: Shop, now = Date.now()): SetupView {
  const base: Base = { shopId: shop.id, photoCount: shop.menuPhotoPaths.length };
  if (shop.status !== 'draft') return { ...base, step: 'live', shop };

  const last = extractions.latest(db, shop.id);
  const recorded = last?.model.startsWith(RECORDED_PREFIX) ?? false;
  if (!last) return { ...base, step: 'reading', running: false, recorded: false };
  if (last.status === 'running') {
    return isStale(last.createdAt, now)
      ? { ...base, step: 'failed', message: FRIENDLY.STALE }
      : { ...base, step: 'reading', running: true, recorded };
  }
  if (last.status === 'failed') return { ...base, step: 'failed', message: friendlyError(last.error) };

  const parsed = MenuExtractionSchema.safeParse(last.raw);
  const result = parsed.success ? normalizeExtraction(parsed.data) : null;
  if (!result) return { ...base, step: 'failed', message: FRIENDLY.AI_ERROR };
  if ('unreadable' in result) return { ...base, step: 'unreadable', reason: result.reason, tip: result.tip };

  // Card text and notes are worked out again from the raw reading, so a shop read before they
  // were plain shows plain text too. Only open cards change: every card action clears the item's
  // issues, so an item with open issues is still exactly as it was read. A card that today's
  // reading would not raise keeps its stored text, so it never loses its explanation.
  const key = (i: { sourceText: string; name: string }) => `${i.sourceText}\n${i.name}`;
  const details = new Map(result.items.map((i) => [key(i), i.issueDetail]));
  const listed = items.listWithVariants(db, shop.id).map((i) => {
    const detail = i.issues.length > 0 ? details.get(key(i)) : null;
    return detail ? { ...i, issueDetail: detail } : i;
  });

  return {
    ...base,
    step: 'review',
    shop: {
      id: shop.id, name: shop.name, about: shop.about, pickupNotes: shop.pickupNotes,
      fulfillment: shop.fulfillment, shippingFeeCents: shop.shippingFeeCents, kind: shop.kind,
    },
    items: listed,
    skipped: last.skipped,
    warnings: result.warnings,
    nonUsd: result.nonUsd,
    recorded,
  };
}
