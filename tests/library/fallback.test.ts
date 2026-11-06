// Part A3: items that never went through a Claude reading (added by hand on the Menu tab, the sample menus' recorded
// readings, older readings) have no stored pick (`example_photo` null); they get a real example by name and category
// whenever the library has a fit, because every picture is matched when it is read (`itemPictures`).
import { describe, expect, it, vi } from 'vitest';
import type { ItemCategory } from '@/lib/domain/category';
import type { LibraryPhoto } from '@/lib/library/types';

vi.mock('@/lib/library/catalog', () => {
  const photo = (id: string, category: string, tags: string[]) => ({
    id, file: `/library/${id}.webp`, type: id, category, tags, shows: id, source: 'https://www.pexels.com/photo/1/', photographer: 'S', licence: 'Pexels License',
  });
  return {
    LIBRARY: [
      photo('croissant-1', 'pastry', ['croissant']),
      photo('sourdough-1', 'bread', ['sourdough', 'loaf']),
      photo('coffee-1', 'coffee', ['coffee']),
      photo('taco-1', 'taco', ['taco']),
      photo('bike-tube-1', 'bike_part', ['inner tube', 'tube', 'flat']),
    ],
  };
});

const { createTestDb } = await import('@/lib/db');
const shops = await import('@/lib/db/repos/shops');
const items = await import('@/lib/db/repos/items');
const { addItem } = await import('@/lib/catalog/edits');
const { normalizeExtraction } = await import('@/lib/ai/normalize');
const { recordedReading, SAMPLE_IDS } = await import('@/lib/ai/samples');
const { pictureSource } = await import('@/lib/library/picture');
const { LIBRARY } = (await import('@/lib/library/catalog')) as { LIBRARY: LibraryPhoto[] };

describe('example photos for items no Claude reading picked one for', () => {
  it('an item added by hand on the Menu tab gets the example its name fits', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Rosa' });
    const added = addItem(db, shop.id, { name: 'Butter croissant', priceCents: 425, sourceText: 'Butter croissant' });
    expect(added.examplePhoto).toBeNull();
    const pic = items.itemPictures(db, shop.id, shop.kind).get(added.id)!;
    expect(pic.exampleUrl).toBe('/library/croissant-1.webp');
  });

  it('a hand-added item nothing in the library fits keeps its drawing', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Rosa' });
    const added = addItem(db, shop.id, { name: 'Gift card', priceCents: 2500, sourceText: 'Gift card' });
    expect(pictureSource(items.itemPictures(db, shop.id, shop.kind).get(added.id)!)).toBe('drawing');
  });

  it.each(SAMPLE_IDS)('the recorded reading of %s: matched items get a real example', (id) => {
    const reading = normalizeExtraction(recordedReading(id), LIBRARY);
    if (!('items' in reading)) throw new Error('unreadable sample');
    const db = createTestDb();
    const { shop } = shops.create(db, { name: id });
    const kind = reading.kind;
    const saved = items.replaceDrafts(db, shop.id, reading.items);
    const pictures = items.itemPictures(db, shop.id, kind);
    const examples = saved.filter((i) => pictures.get(i.id)!.exampleUrl);
    expect(examples.length).toBeGreaterThan(0);
    for (const i of examples) expect(pictures.get(i.id)!.exampleUrl).toMatch(/^\/library\/[a-z0-9-]+\.webp$/);
  });

  it('the category alone still finds a photo of its kind', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Rosa' });
    const [it_] = items.replaceDrafts(db, shop.id, [
      {
        section: null, name: 'House special', description: null, sourceText: 'House special', confidence: 'high', kind: 'PHYSICAL',
        issues: [], issueDetail: null, status: 'draft', category: 'taco' as ItemCategory, variants: [{ label: null, priceCents: 300 }],
      },
    ]);
    expect(items.itemPictures(db, shop.id, 'food').get(it_.id)!.exampleUrl).toBe('/library/taco-1.webp');
  });
});
