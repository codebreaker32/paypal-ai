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

  it('sends Claude the shop’s items (not removed ones) and a copy of the photo it will not scale down, with its size', async () => {
    const match = vi.fn<(p: CounterPhoto, i: CounterItem[]) => Promise<CounterMatch[]>>(async () => []);
    await proposeCounterPhotos(db, shopId, photo, { match });
    const [sent, list] = match.mock.calls[0];
    expect(list.map((i) => i.id).sort()).toEqual([almond, butter].sort());
    expect(list.map((i) => i.id)).not.toContain(gone);
    expect(sent.mediaType).toBe('image/jpeg');
    // Claude scales down a long edge over 1568 px or over ~1.15 MP first, and its boxes would be in that smaller space.
    expect(Math.max(sent.width, sent.height)).toBeLessThanOrEqual(1568);
    expect(sent.width * sent.height).toBeLessThanOrEqual(1_150_000);
    expect(Math.abs(sent.width / sent.height - 4 / 3)).toBeLessThan(0.01);
    expect(sent.width).toBeGreaterThan(1200);
    const meta = await sharp(sent.data).metadata();
    expect([meta.width, meta.height]).toEqual([sent.width, sent.height]);
  });

  it('a wide photo is held to 1568 px on its long edge', async () => {
    const wide = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#d2aa6e' } }).jpeg().toBuffer();
    const match = vi.fn<(p: CounterPhoto, i: CounterItem[]) => Promise<CounterMatch[]>>(async () => []);
    await proposeCounterPhotos(db, shopId, wide, { match });
    const [sent] = match.mock.calls[0];
    expect(sent.width).toBe(1568);
    expect(sent.width * sent.height).toBeLessThanOrEqual(1_150_000);
  });

  it('scales Claude’s boxes back to the 2000 px photo, so a crop shows what Claude boxed', async () => {
    // A red tile at x 1200–1600, y 800–1200 of a 2000 × 1500 photo.
    const red = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#e01010' } }).png().toBuffer();
    const big = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#d2aa6e' } })
      .composite([{ input: red, left: 1200, top: 800 }])
      .jpeg()
      .toBuffer();
    const match = async (p: CounterPhoto): Promise<CounterMatch[]> => {
      const k = p.width / 2000;
      return [{ itemId: almond, box: { x0: 1200 * k, y0: 800 * k, x1: 1600 * k, y1: 1200 * k }, confidence: 'high' }];
    };
    const [proposal] = await proposeCounterPhotos(db, shopId, big, { match });
    const crop = sharp(Buffer.from(proposal.image.split(',')[1], 'base64'));
    const { width, height } = await crop.metadata();
    const { data } = await crop.extract({ left: Math.round(width! / 2) - 5, top: Math.round(height! / 2) - 5, width: 10, height: 10 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(180); // red
    expect(data[1]).toBeLessThan(80);
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
