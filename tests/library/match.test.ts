import { describe, expect, it } from 'vitest';
import type { ItemCategory } from '@/lib/domain/category';
import type { ShopKind } from '@/lib/domain/types';
import type { LibraryPhoto } from '@/lib/library/types';
import { examplePhotos, exampleUrls, matchLibraryPhoto, type MatchItem, type ShopItem } from '@/lib/library/match';
import marigold from '@/lib/ai/samples/marigold-bakehouse.json';
import tiaLupe from '@/lib/ai/samples/tia-lupe-chalkboard.json';
import ravi from '@/lib/ai/samples/ravi-bike-repair.json';

const photo = (id: string, category: ItemCategory, tags: string[]): LibraryPhoto => ({
  id, file: `/library/${id}.webp`, type: id.replace(/-\d+$/, ''), category, tags, shows: id, source: 'https://www.pexels.com/photo/1/',
  photographer: 'Someone', licence: 'Pexels License',
});

/** A small stand-in for the bundled library: several variants of the common types, as the real one has. */
const LIB: LibraryPhoto[] = [
  photo('sourdough-1', 'bread', ['sourdough', 'country loaf', 'boule']),
  photo('rye-1', 'bread', ['rye', 'seeded rye']),
  photo('focaccia-1', 'bread', ['focaccia']),
  photo('loaf-1', 'bread', ['bread', 'loaf']),
  photo('croissant-1', 'pastry', ['croissant', 'butter croissant']),
  photo('croissant-2', 'pastry', ['croissant', 'butter croissant']),
  photo('almond-croissant-1', 'pastry', ['almond croissant']),
  photo('pain-au-chocolat-1', 'pastry', ['pain au chocolat', 'chocolatine']),
  photo('bun-1', 'pastry', ['bun', 'cardamom bun', 'cinnamon bun']),
  photo('galette-1', 'pastry', ['galette', 'fruit galette']),
  photo('cake-1', 'cake', ['cake', 'olive oil cake', 'citrus cake']),
  photo('chocolate-cake-1', 'cake', ['chocolate cake', 'chocolate']),
  photo('coffee-1', 'coffee', ['coffee', 'drip coffee', 'latte']),
  photo('coffee-2', 'coffee', ['coffee', 'latte']),
  photo('tea-1', 'tea', ['tea', 'chai', 'chai latte']),
  photo('taco-1', 'taco', ['taco', 'al pastor']),
  photo('taco-2', 'taco', ['taco', 'carnitas']),
  photo('taco-3', 'taco', ['taco', 'pollo asado', 'chicken taco']),
  photo('taco-4', 'taco', ['taco', 'hongos', 'mushroom taco']),
  photo('guacamole-1', 'meal', ['guacamole', 'guac', 'chips']),
  photo('elote-1', 'meal', ['elote', 'street corn']),
  photo('burrito-1', 'burrito', ['burrito', 'burrito grande']),
  photo('burrito-2', 'burrito', ['burrito', 'bean and cheese']),
  photo('horchata-1', 'drink', ['horchata']),
  photo('soda-1', 'drink', ['jarritos', 'soda']),
  photo('agua-fresca-1', 'drink', ['agua fresca', 'aguas frescas']),
  photo('bike-tube-1', 'bike_part', ['inner tube', 'tube', 'flat fix', 'flat']),
  photo('bike-brake-1', 'bike_part', ['brake', 'brake pads']),
  photo('bike-tune-1', 'tool', ['tune up', 'service']),
  photo('bike-gears-1', 'bike_part', ['gear', 'gears', 'derailleur', 'indexing']),
  photo('bike-chain-1', 'bike_part', ['chain']),
  photo('bike-wheel-1', 'bike_part', ['wheel', 'wheel true', 'truing']),
  photo('kids-bike-1', 'bike_part', ['kids bike', 'bike']),
];

type Reading = { kind: string; items: { section: string | null; name: string | null; description: string | null; category: string | null }[] };
const itemsOf = (r: Reading): ShopItem[] =>
  r.items.map((it, i) => ({ id: `itm_${i}`, name: it.name ?? '', description: it.description, section: it.section, category: it.category as ItemCategory }));
const shopPicks = (r: Reading) => {
  const items = itemsOf(r);
  const map = examplePhotos(items, r.kind as ShopKind, LIB);
  return Object.fromEntries(items.map((it) => [it.name, map.get(it.id)?.id ?? null]));
};

describe('matchLibraryPhoto (an item’s example photo from the bundled library)', () => {
  const match = (name: string, kind: ShopKind = 'food', extra: Partial<MatchItem> = {}, opts = {}) =>
    matchLibraryPhoto({ name, ...extra }, kind, { library: LIB, ...opts })?.id ?? null;

  it('a longer phrase beats a shorter one', () => {
    expect(match('Almond croissant')).toBe('almond-croissant-1');
    expect(match('Pain au chocolat')).toBe('pain-au-chocolat-1');
    expect(match('Chocolate cake')).toBe('chocolate-cake-1');
  });

  it('a coffee cake is a cake and a chai latte is tea, never a cup of coffee', () => {
    expect(match('Coffee cake')).toBe('cake-1');
    expect(match('Chai latte')).toBe('tea-1');
    expect(match('Oat latte')).toMatch(/^coffee-/);
  });

  it('a food shop never gets a bike photo, and a bike shop never gets food', () => {
    expect(match('Brie wheel')).toBeNull();
    expect(match('Chain of donuts')).toBeNull();
    expect(match('Coffee', 'services')).toBeNull();
    expect(match('Bike chain', 'goods')).toBe('bike-chain-1');
  });

  it('an unknown dish, job or thing gets no photo (its drawing), never a random one', () => {
    expect(match('Grandma’s mystery stew')).toBeNull();
    expect(match('Consultation', 'services')).toBeNull();
    expect(match('Hand-thrown mug', 'goods')).toBeNull();
  });

  it('with no tag hit, a specific category still gets a photo of its kind; meal, tool and goods do not', () => {
    expect(match('Kouign-amann', 'food', { category: 'pastry' })).toMatch(/^(croissant|almond-croissant|pain-au-chocolat|bun|galette)-/);
    expect(match('Pozole', 'food', { category: 'meal' })).toBeNull();
    expect(match('Hub service', 'services', { category: 'tool' })).toBe('bike-tune-1');
    expect(match('Derailleur hanger swap', 'services', { category: 'tool' })).toBe('bike-gears-1');
  });

  it('folds case, accents, plurals and “&”; matches whole words only', () => {
    expect(match('AGUAS FRESCAS')).toBe('agua-fresca-1');
    expect(match('Agua fresca del día')).toBe('agua-fresca-1');
    expect(match('Croissants')).toMatch(/^croissant-/);
    expect(match('Bean & cheese', 'food', { section: 'BURRITOS' })).toBe('burrito-2');
    expect(match('Teapot cozy', 'goods')).toBeNull();
  });

  it('the name counts more than the description, and the description more than the section', () => {
    expect(match('Horchata', 'food', { section: 'Coffee' })).toBe('horchata-1');
    expect(match('House special', 'food', { description: 'Al pastor', section: 'Burritos' })).toBe('taco-1');
  });

  it('a valid stored (Claude’s) pick wins; a stale id is ignored', () => {
    expect(match('Butter croissant', 'food', {}, { chosenId: 'croissant-2' })).toBe('croissant-2');
    expect(match('Butter croissant', 'food', {}, { chosenId: 'croissant-9' })).toMatch(/^croissant-[12]$/);
    expect(match('Brie wheel', 'food', {}, { chosenId: 'bike-wheel-1' })).toBeNull();
  });

  it('is deterministic, and steps around photos to avoid', () => {
    const first = match('Butter croissant');
    expect(match('Butter croissant')).toBe(first);
    expect(match('Butter croissant', 'food', {}, { avoid: new Set([first]) })).toBe(first === 'croissant-1' ? 'croissant-2' : 'croissant-1');
  });

  it('an empty library gives nothing', () => {
    expect(matchLibraryPhoto({ name: 'Butter croissant' }, 'food', { library: [] })).toBeNull();
  });
});

describe('examplePhotos (a whole shop)', () => {
  it('Marigold Bakehouse: every item its own kind of photo', () => {
    expect(shopPicks(marigold as Reading)).toMatchObject({
      'Country sourdough loaf': 'sourdough-1',
      'Seeded rye': 'rye-1',
      'Focaccia – rosemary & sea salt': 'focaccia-1',
      'Almond croissant': 'almond-croissant-1',
      'Cardamom bun': 'bun-1',
      'Pain au chocolat': 'pain-au-chocolat-1',
      'Olive oil citrus cake – 8"': 'cake-1',
      'Seasonal fruit galette': 'galette-1',
      'Drip coffee': 'coffee-1',
    });
    expect(shopPicks(marigold as Reading)['Butter croissant']).toMatch(/^croissant-[12]$/);
  });

  it('Tía Lupe’s Tacos: every item a real photo, four tacos four different photos', () => {
    const picks = shopPicks(tiaLupe as Reading);
    expect(picks).toEqual({
      'Al pastor': 'taco-1',
      Carnitas: 'taco-2',
      'Pollo asado': 'taco-3',
      'Hongos (veg)': 'taco-4',
      'Guac + chips': 'guacamole-1',
      Elote: 'elote-1',
      'Burrito grande': 'burrito-1',
      'Bean & cheese': 'burrito-2',
      Horchata: 'horchata-1',
      Jarritos: 'soda-1',
      'Agua fresca del día': 'agua-fresca-1',
    });
  });

  it('Ravi’s Bike Repair: every job a bike photo', () => {
    expect(shopPicks(ravi as Reading)).toEqual({
      'Flat fix (tube incl.)': 'bike-tube-1',
      'Brake tune — per wheel': 'bike-brake-1',
      'Full tune-up': 'bike-tune-1',
      'Gear indexing': 'bike-gears-1',
      'Chain replace (+ parts)': 'bike-chain-1',
      'Wheel true': 'bike-wheel-1',
      'Kids bike safety check': 'kids-bike-1',
    });
  });

  it('two items of one shop do not share a photo while another variant fits as well', () => {
    const items: ShopItem[] = [
      { id: 'a', name: 'Butter croissant' },
      { id: 'b', name: 'Plain croissant' },
      { id: 'c', name: 'Croissant, day old' },
    ];
    const map = examplePhotos(items, 'food', LIB);
    expect(new Set([map.get('a')!.id, map.get('b')!.id])).toEqual(new Set(['croissant-1', 'croissant-2']));
    // A third croissant reuses one rather than showing something else.
    expect(map.get('c')!.id).toMatch(/^croissant-[12]$/);
  });

  it('an item with its own photo gets no example and uses up none', () => {
    const map = examplePhotos([{ id: 'a', name: 'Butter croissant', photoUrl: '/i/x.webp' }, { id: 'b', name: 'Croissant' }, { id: 'c', name: 'Croissant' }], 'food', LIB);
    expect(map.get('a')).toBeNull();
    expect(new Set([map.get('b')!.id, map.get('c')!.id]).size).toBe(2);
  });

  it('an empty library: every item null (the drawing)', () => {
    const map = examplePhotos(itemsOf(marigold as Reading), 'food', []);
    expect([...map.values()].every((v) => v === null)).toBe(true);
  });
});

describe('exampleUrls (what a thumbnail shows when the item has no photo of its own)', () => {
  it('the library file, a cached Pexels match’s served file, or null', () => {
    const map = exampleUrls(
      [
        { id: 'a', name: 'Butter croissant', examplePhoto: 'croissant-2' },
        { id: 'b', name: 'Pozole', examplePhoto: 'pexels:123' },
        { id: 'c', name: 'Pozole', examplePhoto: 'pexels:../../etc' },
        { id: 'd', name: 'Butter croissant', photoUrl: '/i/mine.webp', examplePhoto: 'croissant-1' },
        { id: 'e', name: 'Grandma’s mystery stew' },
      ],
      'food',
      LIB,
    );
    expect(Object.fromEntries(map)).toEqual({ a: '/library/croissant-2.webp', b: '/i/library/pexels-123.webp', c: null, d: null, e: null });
  });
});
