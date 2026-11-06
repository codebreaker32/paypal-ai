import { describe, expect, it } from 'vitest';
import { CATEGORIES, guessCategory, itemCategory, type ItemCategory } from '@/lib/domain/category';
import type { ShopKind } from '@/lib/domain/types';

describe('guessCategory', () => {
  it.each<[string, ShopKind, ItemCategory]>([
    ['Country sourdough loaf', 'food', 'bread'],
    ['Almond croissant', 'food', 'pastry'],
    ['Olive oil citrus cake – 8"', 'food', 'cake'],
    ['Drip coffee', 'food', 'coffee'],
    ['Chai', 'food', 'tea'],
    ['Carnitas taco', 'food', 'taco'],
    ['Bean burrito', 'food', 'burrito'],
    ['Horchata', 'food', 'drink'],
    ['Flan', 'food', 'dessert'],
    ['Inner tube 700c', 'goods', 'bike_part'],
    ['Full tune-up', 'services', 'tool'],
    ['Beeswax candle', 'goods', 'goods'],
  ])('%j in a %s shop → %s', (name, shopKind, category) => {
    expect(guessCategory({ name, shopKind })).toBe(category);
  });

  it('reads the section and description when the name alone says nothing', () => {
    expect(guessCategory({ name: 'The Marigold', section: 'Breads', shopKind: 'food' })).toBe('bread');
    expect(guessCategory({ name: 'House special', description: 'A flaky butter danish', shopKind: 'food' })).toBe('pastry');
  });

  it('an unknown food item falls back to a food picture, an unknown service to a tool, anything else to goods', () => {
    expect(CATEGORIES).toContain(guessCategory({ name: 'Mystery plate', shopKind: 'food' }));
    expect(guessCategory({ name: 'Mystery plate', shopKind: 'food' })).not.toBe('bike_part');
    expect(guessCategory({ name: 'Consultation', shopKind: 'services' })).toBe('tool');
    expect(guessCategory({ name: 'Thing', shopKind: 'goods' })).toBe('goods');
  });

  it('matches whole words, not fragments ("Teapot stand" is not tea, "Bunting" is not a bun)', () => {
    expect(guessCategory({ name: 'Bunting garland', shopKind: 'goods' })).toBe('goods');
    expect(guessCategory({ name: 'Steak plate', shopKind: 'food' })).not.toBe('tea');
  });
});

describe('itemCategory', () => {
  const base = { name: 'Country sourdough loaf', section: 'Breads', description: null };

  it('a stored category beats the guess', () => {
    expect(itemCategory({ ...base, category: 'cake' }, 'food')).toBe('cake');
  });

  it('no stored category (old rows, recordings without one) → the keyword guess, never a crash', () => {
    expect(itemCategory({ ...base, category: null }, 'food')).toBe('bread');
  });

  it('ignores a stored value that is not a known category', () => {
    expect(itemCategory({ ...base, category: 'sandwich' as ItemCategory }, 'food')).toBe('bread');
  });
});
