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

  it('an unknown food item falls back to a food picture (meal), an unknown service to a tool, anything else to goods', () => {
    expect(CATEGORIES).toContain('meal');
    expect(guessCategory({ name: 'Mystery plate', shopKind: 'food' })).toBe('meal');
    // Tía Lupe's extras were drawn as a shopping bag before `meal` existed.
    expect(guessCategory({ name: 'Guac + chips', section: 'EXTRAS', shopKind: 'food' })).toBe('meal');
    expect(guessCategory({ name: 'Elote', section: 'EXTRAS', shopKind: 'food' })).toBe('meal');
    expect(guessCategory({ name: 'Consultation', shopKind: 'services' })).toBe('tool');
    expect(guessCategory({ name: 'Thing', shopKind: 'goods' })).toBe('goods');
  });

  it('a food shop never gets a part or a tool from a keyword ("Brie wheel", "Catering service")', () => {
    for (const name of ['Brie wheel', 'Catering service', 'Chain of sausages', 'Tube of frosting']) {
      expect(['bike_part', 'tool']).not.toContain(guessCategory({ name, shopKind: 'food' }));
    }
    expect(guessCategory({ name: 'Inner tube 700c', shopKind: 'goods' })).toBe('bike_part');
    expect(guessCategory({ name: 'Wheel true', shopKind: 'services' })).toBe('tool');
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
