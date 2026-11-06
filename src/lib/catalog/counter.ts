// "Snap your counter" (spec §4b): the seller photographs the display case, Claude boxes the menu items it can see
// (src/lib/ai/counter.ts), and each box becomes a proposed 4:3 item photo (src/lib/photos/crop.ts). Stateless: the
// proposals go back to the browser as data URLs and nothing is stored; the seller's "Use" uploads a crop through the
// item-photo route, so every kept photo still passes the one upload path.
import sharp from 'sharp';
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import { matchCounterPhoto, type CounterConfidence, type CounterItem, type CounterMatch, type CounterPhoto } from '@/lib/ai/counter';
import { cropRect } from '@/lib/photos/crop';
import { decodePhotoPixels } from '@/lib/uploads';

export interface CounterProposal {
  itemId: string;
  name: string;
  confidence: CounterConfidence;
  /** The proposed photo, a 4:3 WebP data URL (at most 1200 × 900). */
  image: string;
}

/** The photo upright and fitted to 2000 px, decoded once to pixels: Claude's copy and every crop are cut from it. */
const COUNTER_EDGE = 2000;
const CROP_WIDTH = 1200;
/**
 * Claude scales an image down before looking at it when its long edge is over 1568 px or it is over ~1.15 MP, and its
 * boxes would then be in that smaller space. So Claude gets a copy within both limits (and is told its size), and its
 * boxes are scaled back up to the 2000 px photo.
 */
const CLAUDE_MAX_EDGE = 1568;
const CLAUDE_MAX_PIXELS = 1_150_000;

/** The size of the copy Claude sees: the photo's aspect, within both of Claude's limits, never enlarged. */
export function claudeSize(width: number, height: number): { width: number; height: number } {
  const k = Math.min(1, CLAUDE_MAX_EDGE / Math.max(width, height), Math.sqrt(CLAUDE_MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * k)), height: Math.max(1, Math.floor(height * k)) };
}

type Match = (photo: CounterPhoto, items: CounterItem[]) => Promise<CounterMatch[]>;

/**
 * Proposed item photos from a display-case photo. Throws UploadError (BAD_IMAGE, PHOTO_TOO_LARGE) for the photo, or
 * whatever the match throws (a Claude failure).
 */
export async function proposeCounterPhotos(
  db: Db,
  shopId: string,
  input: Buffer,
  deps: { match?: Match; signal?: AbortSignal } = {},
): Promise<CounterProposal[]> {
  const full = await decodePhotoPixels(input, COUNTER_EDGE);
  const { width, height } = full;
  const pixels = () => sharp(full.data, { raw: { width, height, channels: full.channels } });
  const items = itemsRepo.listWithVariants(db, shopId).filter((i) => i.status !== 'removed');
  if (!items.length) return [];
  const size = claudeSize(width, height);
  const small = await pixels().resize(size.width, size.height, { fit: 'fill' }).jpeg({ quality: 85 }).toBuffer();
  const photo: CounterPhoto = { data: small, mediaType: 'image/jpeg', ...size };
  const sx = width / size.width;
  const sy = height / size.height;
  const list: CounterItem[] = items.map((i) => ({ id: i.id, name: i.name, section: i.section, description: i.description }));
  const match = deps.match ?? ((p, l) => matchCounterPhoto(p, l, { signal: deps.signal }));

  const byId = new Map(items.map((i) => [i.id, i]));
  const proposals: CounterProposal[] = [];
  for (const m of await match(photo, list)) {
    const item = byId.get(m.itemId);
    if (!item) continue;
    const box = { x0: m.box.x0 * sx, y0: m.box.y0 * sy, x1: m.box.x1 * sx, y1: m.box.y1 * sy };
    const rect = cropRect(box, width, height);
    const webp = await pixels()
      .extract(rect)
      .resize({ width: Math.min(CROP_WIDTH, rect.width), height: Math.round(Math.min(CROP_WIDTH, rect.width) * 0.75), fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    proposals.push({ itemId: item.id, name: item.name, confidence: m.confidence, image: `data:image/webp;base64,${webp.toString('base64')}` });
  }
  return proposals;
}
