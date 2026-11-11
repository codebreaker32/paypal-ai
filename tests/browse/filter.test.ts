import { describe, expect, it } from 'vitest';
import { browseChips, matchesBrowse, parseBrowseFilter, type BrowseEntry } from '@/lib/browse';

const TACOS: BrowseEntry = { name: 'Tía Lupe’s Tacos', category: 'food', itemNames: ['Al pastor taco', 'Horchata'] };
const PETALS: BrowseEntry = { name: 'Petal Stand', category: 'flowers', itemNames: ['Tulip bunch'] };
const PLAIN: BrowseEntry = { name: 'Odd Shop', category: null, itemNames: [] };

describe('matchesBrowse', () => {
  it('matches the shop name or an item name, ignoring case and accents', () => {
    expect(matchesBrowse(TACOS, 'tia lupe', 'all')).toBe(true);
    expect(matchesBrowse(TACOS, 'HORCHATA', 'all')).toBe(true);
    expect(matchesBrowse(TACOS, 'tulip', 'all')).toBe(false);
    expect(matchesBrowse(TACOS, '  ', 'all')).toBe(true);
  });
  it('needs every word', () => {
    expect(matchesBrowse(TACOS, 'pastor taco', 'all')).toBe(true);
    expect(matchesBrowse(TACOS, 'pastor tulip', 'all')).toBe(false);
  });
  it('keeps a shop with no category under All only', () => {
    expect(matchesBrowse(PLAIN, '', 'all')).toBe(true);
    expect(matchesBrowse(PLAIN, '', 'food')).toBe(false);
    expect(matchesBrowse(PETALS, '', 'flowers')).toBe(true);
    expect(matchesBrowse(PETALS, '', 'food')).toBe(false);
  });
});

describe('browseChips', () => {
  it('shows All and only the categories some shop has, in the fixed order', () => {
    expect(browseChips([PETALS, PLAIN, TACOS]).map((c) => c.label)).toEqual(['All', 'Food', 'Flowers']);
    expect(browseChips([PLAIN]).map((c) => c.label)).toEqual(['All']);
  });
  it('parses the ?category= value', () => {
    expect(parseBrowseFilter('drinks')).toBe('drinks');
    expect(parseBrowseFilter('Drinks')).toBe('all');
    expect(parseBrowseFilter(undefined)).toBe('all');
  });
});
