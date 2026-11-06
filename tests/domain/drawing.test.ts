import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/lib/domain/category';
import { DRAWING_IDS, drawingId, pastryVariant } from '@/lib/domain/drawing';

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

  it('leaves every other category as its own drawing', () => {
    expect(drawingId('bread', 'Cinnamon raisin loaf')).toBe('bread');
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
