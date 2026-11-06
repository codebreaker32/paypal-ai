// "Snap your counter" (spec §4b): the seller photographs the display case, Claude boxes the menu items it can see
// (src/lib/ai/counter.ts), and each box becomes a proposed 4:3 item photo (src/lib/photos/crop.ts). Stateless: the
// proposals go back to the browser as data URLs and nothing is stored; the seller's "Use" uploads a crop through the
// item-photo route, so every kept photo still passes the one upload path.
import sharp from 'sharp';
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import { matchCounterPhoto, type CounterConfidence, type CounterItem, type CounterMatch, type CounterPhoto } from '@/lib/ai/counter';
import { cropRect } from '@/lib/photos/crop';
import { normalizePhoto, type PhotoEncoding } from '@/lib/uploads';

export interface CounterProposal {
  itemId: string;
  name: string;
  confidence: CounterConfidence;
  /** The proposed photo, a 4:3 WebP data URL (at most 1200 × 900). */
  image: string;
}

/** What Claude sees: the photo upright and fitted to 2000 px, which keeps small items legible. */
const COUNTER_PHOTO: PhotoEncoding = { maxEdge: 2000, format: 'jpeg', quality: 85 };
const CROP_WIDTH = 1200;

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
  const jpeg = await normalizePhoto(input, COUNTER_PHOTO);
  const items = itemsRepo.listWithVariants(db, shopId).filter((i) => i.status !== 'removed');
  if (!items.length) return [];
  const { width, height } = await sharp(jpeg).metadata();
  const photo: CounterPhoto = { data: jpeg, mediaType: 'image/jpeg', width: width!, height: height! };
  const list: CounterItem[] = items.map((i) => ({ id: i.id, name: i.name, section: i.section, description: i.description }));
  const match = deps.match ?? ((p, l) => matchCounterPhoto(p, l, { signal: deps.signal }));

  const byId = new Map(items.map((i) => [i.id, i]));
  const proposals: CounterProposal[] = [];
  for (const m of await match(photo, list)) {
    const item = byId.get(m.itemId);
    if (!item) continue;
    const rect = cropRect(m.box, photo.width, photo.height);
    const webp = await sharp(jpeg)
      .extract(rect)
      .resize({ width: Math.min(CROP_WIDTH, rect.width), height: Math.round(Math.min(CROP_WIDTH, rect.width) * 0.75), fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    proposals.push({ itemId: item.id, name: item.name, confidence: m.confidence, image: `data:image/webp;base64,${webp.toString('base64')}` });
  }
  return proposals;
}
