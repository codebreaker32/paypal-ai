// /browse's search and chips, pure so the page's client filter and the tests share one rule.
import { SHOP_CATEGORIES, type ShopCategory } from '@/lib/domain/shop-category';

export interface BrowseEntry {
  name: string;
  category: ShopCategory | null;
  itemNames: string[];
}

export type BrowseFilter = ShopCategory | 'all';

/** Lower case, accents dropped and spaces squeezed, so "tia lupe" finds "Tía Lupe’s Tacos". */
export const foldText = (s: string): string =>
  s.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’']/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();

/** Every word of the query appears in the shop's name or one of its item names; the chip matches its category. */
export function matchesBrowse(entry: BrowseEntry, query: string, filter: BrowseFilter): boolean {
  if (filter !== 'all' && entry.category !== filter) return false;
  const words = foldText(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = foldText([entry.name, ...entry.itemNames].join(' \u0000 '));
  return words.every((w) => haystack.includes(w));
}

/** The chips to show: All, then each category at least one shop has, in the fixed order. */
export function browseChips(entries: BrowseEntry[]): { id: BrowseFilter; label: string }[] {
  const present = new Set(entries.map((e) => e.category));
  return [{ id: 'all', label: 'All' }, ...SHOP_CATEGORIES.filter((c) => present.has(c.id))];
}

export const parseBrowseFilter = (raw: unknown): BrowseFilter =>
  SHOP_CATEGORIES.some((c) => c.id === raw) ? (raw as ShopCategory) : 'all';
