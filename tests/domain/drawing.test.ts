import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/lib/domain/category';
import { breadVariant, DRAWING_IDS, drawingId, pastryVariant } from '@/lib/domain/drawing';

describe('pastryVariant', () => {
  it.each([
    ['Cardamom bun', 'bun'],
    ['Cinnamon roll', 'bun'],
    ['Morning buns', 'bun'],
    ['Seasonal fruit galette', 'tart'],
    ['Lemon tart', 'tart'],
    ['Apple pie', 'tart'],
    ['Leek quiche', 'tart'],
    ['Apricot crostata', 'tart'],
    ['Pain au chocolat', 'pain'],
    ['Chocolatine', 'pain'],
    ['Almond croissant', 'croissant'],
    ['Cinnamon sugar croissant', 'croissant'],
    ['Kouign amann', 'croissant'],
    ['Viennoiserie of the day', 'croissant'],
  ] as const)('%s -> %s', (name, variant) => {
    expect(pastryVariant(name)).toBe(variant);
  });
});

describe('breadVariant', () => {
  it.each([
    ['Country sourdough loaf', 'boule'],
    ['Sourdough', 'boule'],
    ['Pain de campagne', 'boule'],
    ['Miche', 'boule'],
    ['Round levain', 'boule'],
    ['Focaccia – rosemary & sea salt', 'focaccia'],
    ['Focaccia', 'focaccia'],
    ['Sourdough focaccia', 'focaccia'],
    ['Schiacciata with grapes', 'focaccia'],
    ['Baguette', 'baguette'],
    ['Sourdough baguette', 'baguette'],
    ['Seeded bâtard', 'baguette'],
    ['Ficelle', 'baguette'],
    ['Seeded rye', 'loaf'],
    ['Sandwich loaf', 'loaf'],
    ['Cinnamon raisin loaf', 'loaf'],
    ['Something crusty', 'loaf'],
  ] as const)('%s -> %s', (name, variant) => {
    expect(breadVariant(name)).toBe(variant);
  });

  it('gives the three Marigold breads three different drawings', () => {
    const ids = ['Country sourdough loaf', 'Seeded rye', 'Focaccia – rosemary & sea salt'].map((n) => drawingId('bread', n));
    expect(new Set(ids).size).toBe(3);
  });
});

describe('drawingId', () => {
  it('picks the pastry variant from the name', () => {
    expect(drawingId('pastry', 'Cardamom bun')).toBe('pastry-bun');
    expect(drawingId('pastry', 'Seasonal fruit galette')).toBe('pastry-tart');
    expect(drawingId('pastry', 'Pain au chocolat')).toBe('pastry-pain');
  });

  it('keeps the croissant for croissants, unknown pastries and a missing name', () => {
    expect(drawingId('pastry', 'Almond croissant')).toBe('pastry');
    expect(drawingId('pastry', 'Something flaky')).toBe('pastry');
    expect(drawingId('pastry')).toBe('pastry');
  });

  it('picks the bread variant from the name, the loaf when nothing matches', () => {
    expect(drawingId('bread', 'Country sourdough loaf')).toBe('bread-boule');
    expect(drawingId('bread', 'Focaccia – rosemary & sea salt')).toBe('bread-focaccia');
    expect(drawingId('bread', 'Baguette')).toBe('bread-baguette');
    expect(drawingId('bread', 'Cinnamon raisin loaf')).toBe('bread');
    expect(drawingId('bread', 'Seeded rye')).toBe('bread');
    expect(drawingId('bread')).toBe('bread');
  });

  it('leaves every other category as its own drawing', () => {
    expect(drawingId('dessert', 'Apple pie')).toBe('dessert');
  });
});

describe('public/illustrations.svg', () => {
  it('has a symbol for every drawing id, so no tile is blank', () => {
    const sheet = readFileSync(join(process.cwd(), 'public/illustrations.svg'), 'utf8');
    const symbols = [...sheet.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    expect(symbols.sort()).toEqual([...DRAWING_IDS].sort());
    for (const category of CATEGORIES) expect(DRAWING_IDS).toContain(category);
  });
});
