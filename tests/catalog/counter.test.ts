// "Snap your counter" (spec §4b): a display-case photo → Claude's boxes → one proposed 4:3 crop per item, for the seller
// to keep or skip. Stateless: nothing is stored until the seller uploads a crop through the item-photo route.
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as items from '@/lib/db/repos/items';
import { createShopFromSample } from '@/lib/catalog/setup';
import { proposeCounterPhotos } from '@/lib/catalog/counter';
import type { CounterItem, CounterMatch, CounterPhoto } from '@/lib/ai/counter';

const draft = (name: string, status: 'draft' | 'in_person' | 'removed' = 'draft') => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high' as const, kind: 'PHYSICAL' as const,
  issues: [], issueDetail: null, status, variants: [{ label: null, priceCents: 500 }],
});

describe('proposeCounterPhotos', () => {
  let db: Db;
  let shopId: string;
  let almond: string;
  let butter: string;
  let gone: string;
  let photo: Buffer;

  beforeEach(async () => {
    db = createTestDb();
    shopId = (await createShopFromSample(db, 'marigold-bakehouse')).shop.id;
    items.replaceDrafts(db, shopId, []);
    almond = items.insertDraft(db, shopId, draft('Almond croissant')).id;
    butter = items.insertDraft(db, shopId, draft('Butter croissant')).id;
    items.update(db, butter, { status: 'live' });
    gone = items.insertDraft(db, shopId, draft('Old scone', 'removed')).id;
    photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 210, g: 170, b: 110 } } }).jpeg().toBuffer();
  });

  it('sends Claude the shop’s items (not removed ones) and the photo at its upright size', async () => {
    const match = vi.fn<(p: CounterPhoto, i: CounterItem[]) => Promise<CounterMatch[]>>(async () => []);
    await proposeCounterPhotos(db, shopId, photo, { match });
    const [sent, list] = match.mock.calls[0];
    expect(list.map((i) => i.id).sort()).toEqual([almond, butter].sort());
    expect(list.map((i) => i.id)).not.toContain(gone);
    expect(sent.mediaType).toBe('image/jpeg');
    expect([sent.width, sent.height]).toEqual([1600, 1200]);
    expect((await sharp(sent.data).metadata()).width).toBe(1600);
  });

  it('turns each match into a 4:3 WebP crop with the item’s name and confidence', async () => {
    const match = async (): Promise<CounterMatch[]> => [
      { itemId: almond, box: { x0: 100, y0: 100, x1: 500, y1: 400 }, confidence: 'high' },
      { itemId: butter, box: { x0: 900, y0: 600, x1: 1300, y1: 1000 }, confidence: 'medium' },
    ];
    const proposals = await proposeCounterPhotos(db, shopId, photo, { match });
    expect(proposals.map((p) => [p.itemId, p.name, p.confidence])).toEqual([
      [almond, 'Almond croissant', 'high'],
      [butter, 'Butter croissant', 'medium'],
    ]);
    for (const p of proposals) {
      expect(p.image).toMatch(/^data:image\/webp;base64,/);
      const meta = await sharp(Buffer.from(p.image.split(',')[1], 'base64')).metadata();
      expect(meta.format).toBe('webp');
      expect(Math.abs(meta.width! / meta.height! - 4 / 3)).toBeLessThan(0.02);
      expect(meta.width).toBeLessThanOrEqual(1200);
    }
  });

  it('drops a match for an item that is not in this shop', async () => {
    const match = async (): Promise<CounterMatch[]> => [
      { itemId: 'itm_someone_else', box: { x0: 0, y0: 0, x1: 400, y1: 300 }, confidence: 'high' },
    ];
    expect(await proposeCounterPhotos(db, shopId, photo, { match })).toEqual([]);
  });

  it('asks nothing when the shop has no items', async () => {
    items.replaceDrafts(db, shopId, []);
    db.prepare('DELETE FROM items WHERE shop_id = ?').run(shopId);
    const match = vi.fn(async (): Promise<CounterMatch[]> => []);
    expect(await proposeCounterPhotos(db, shopId, photo, { match })).toEqual([]);
    expect(match).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a photo (BAD_IMAGE) before asking Claude', async () => {
    const match = vi.fn(async (): Promise<CounterMatch[]> => []);
    await expect(proposeCounterPhotos(db, shopId, Buffer.from('not an image'), { match })).rejects.toMatchObject({ code: 'BAD_IMAGE' });
    expect(match).not.toHaveBeenCalled();
  });
});
