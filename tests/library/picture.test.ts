import { describe, expect, it } from 'vitest';
import type { ItemCategory } from '@/lib/domain/category';
import type { LibraryPhoto } from '@/lib/library/types';
import { itemPictures, pictureOf, pictureSource, pictureSrc } from '@/lib/library/picture';

const photo = (id: string, category: ItemCategory, tags: string[]): LibraryPhoto => ({
  id, file: `/library/${id}.webp`, type: id, category, tags, shows: id, source: 'https://www.pexels.com/photo/1/',
  photographer: 'Someone', licence: 'Pexels License',
});
const LIB = [photo('croissant-1', 'pastry', ['croissant']), photo('sourdough-1', 'bread', ['sourdough'])];

const item = (over: Partial<{ id: string; name: string; photoUrl: string | null; examplePhoto: string | null; category: ItemCategory | null }> = {}) => ({
  id: 'itm_1', name: 'Butter croissant', section: 'Pastry', description: null, photoUrl: null, examplePhoto: null, category: null, ...over,
});

describe('the picture order: own photo, then example, then drawing', () => {
  it('the seller’s own photo wins over an example', () => {
    const p = pictureOf(item({ photoUrl: '/i/img_a.webp' }), 'food', '/library/croissant-1.webp');
    expect(p).toEqual({ photoUrl: '/i/img_a.webp', exampleUrl: null, category: 'pastry' });
    expect(pictureSource(p)).toBe('own');
    expect(pictureSrc(p)).toBe('/i/img_a.webp');
  });

  it('with no own photo, the example shows', () => {
    const p = pictureOf(item(), 'food', '/library/croissant-1.webp');
    expect(pictureSource(p)).toBe('example');
    expect(pictureSrc(p)).toBe('/library/croissant-1.webp');
  });

  it('with neither, the category drawing shows', () => {
    const p = pictureOf(item(), 'food', null);
    expect(pictureSource(p)).toBe('drawing');
    expect(pictureSrc(p)).toBeNull();
    expect(p.category).toBe('pastry');
  });

  it('a picture without the exampleUrl field (older callers) is own or drawing', () => {
    expect(pictureSource({ photoUrl: null, category: 'bread' })).toBe('drawing');
    expect(pictureSource({ photoUrl: '/i/x.webp', category: 'bread' })).toBe('own');
  });
});

describe('itemPictures (a whole menu)', () => {
  it('matches examples across the menu and keeps own photos', () => {
    const items = [
      item({ id: 'a', name: 'Butter croissant' }),
      item({ id: 'b', name: 'Country sourdough', photoUrl: '/i/img_b.webp' }),
      item({ id: 'c', name: 'Mystery box', category: 'goods' }),
    ];
    const map = itemPictures(items, 'food', LIB);
    expect(pictureSource(map.get('a')!)).toBe('example');
    expect(map.get('a')!.exampleUrl).toBe('/library/croissant-1.webp');
    expect(pictureSource(map.get('b')!)).toBe('own');
    expect(pictureSource(map.get('c')!)).toBe('drawing');
  });

  it('an empty library leaves every item without a photo on its drawing', () => {
    const map = itemPictures([item({ id: 'a' })], 'food', []);
    expect(pictureSource(map.get('a')!)).toBe('drawing');
  });

  it('a cached live Pexels pick is an example too', () => {
    const map = itemPictures([item({ id: 'a', examplePhoto: 'pexels:42' })], 'food', LIB);
    expect(map.get('a')!.exampleUrl).toBe('/i/library/pexels-42.webp');
  });
});
