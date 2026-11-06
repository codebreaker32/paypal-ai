import { itemCategory, isItemCategory, type ItemCategory } from '@/lib/domain/category';
import type { ShopKind } from '@/lib/domain/types';
import { LIBRARY } from './catalog';
import type { LibraryPhoto } from './types';

/**
 * Which bundled library photo shows an item as an *example* (Part A3): the item's own photo always wins (callers check
 * `photoUrl` first), then Claude's pick from the menu reading, then the photo whose tags best match the item's words,
 * then a photo of the item's category for the specific categories only. Nothing fits: null, and the item keeps its
 * drawing. Pure and deterministic: the same menu gives the same photos on every render.
 */

export interface MatchItem {
  name: string;
  description?: string | null;
  section?: string | null;
  category?: ItemCategory | null;
  /** The stored pick (`items.example_photo`): a library id, or `pexels:<id>` (resolved elsewhere, ignored here). */
  examplePhoto?: string | null;
  /** The seller's own photo: an item with one needs no example. */
  photoUrl?: string | null;
}

/** An item of a shop's menu, for the shop-wide matches. */
export type ShopItem = MatchItem & { id: string };

export interface MatchOptions {
  /** Claude's (stored) pick: wins when it is in the library and allowed for the shop. */
  chosenId?: string | null;
  /** Photos already shown on this shop: a variant that fits as well is preferred. */
  avoid?: ReadonlySet<string>;
  library?: readonly LibraryPhoto[];
}

const FOOD: ReadonlySet<ItemCategory> = new Set(['bread', 'pastry', 'cake', 'coffee', 'tea', 'taco', 'burrito', 'drink', 'dessert', 'meal']);
const NOT_FOOD: ReadonlySet<ItemCategory> = new Set(['bike_part', 'tool']);
/**
 * With no tag hit, these categories still get a photo of their kind; `meal`, `tool` and `goods` are too broad, and so
 * is `bike_part`: a brake caliper is no example of pedals or a saddle, so an unmatched part keeps its drawing.
 */
const FALLBACK: ReadonlySet<ItemCategory> = new Set(['bread', 'pastry', 'cake', 'coffee', 'tea', 'taco', 'burrito', 'drink', 'dessert']);
/** Categories that look alike: a galette photo may be filed as pastry or dessert; a coffee is never a cake. */
const FAMILY: Partial<Record<ItemCategory, string>> = {
  pastry: 'sweet', cake: 'sweet', dessert: 'sweet', taco: 'mex', burrito: 'mex', bike_part: 'bike', tool: 'bike',
};
const BROAD: ReadonlySet<ItemCategory> = new Set(['meal', 'goods']);

const compatible = (item: ItemCategory, photo: ItemCategory) =>
  item === photo || BROAD.has(item) || BROAD.has(photo) || (FAMILY[item] !== undefined && FAMILY[item] === FAMILY[photo]);

/** Whether a shop of this kind may show the photo at all: food never shows bike parts, a services shop never food. */
function allowedForShop(photo: LibraryPhoto, shopKind: ShopKind, item: ItemCategory): boolean {
  if (shopKind === 'food') return !NOT_FOOD.has(photo.category);
  if (shopKind === 'services') return !FOOD.has(photo.category);
  return !FOOD.has(photo.category) || FOOD.has(item);
}

/** A crude, symmetric stem: "loaves"/"loaf", "pastries"/"pastry", "cookies"/"cookie", "tacos"/"taco" fold alike. */
function stem(word: string): string {
  let w = word;
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.endsWith('y')) w = `${w.slice(0, -1)}i`;
  if (w.endsWith('f')) w = `${w.slice(0, -1)}v`;
  return w;
}

/** Lower-case words, accents dropped, "&" read as "and", each word stemmed. */
export function words(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/** Where a phrase first occurs as whole consecutive words, or -1. */
function find(haystack: string[], phrase: string[]): number {
  if (!phrase.length) return -1;
  outer: for (let i = 0; i + phrase.length <= haystack.length; i++) {
    for (let j = 0; j < phrase.length; j++) if (haystack[i + j] !== phrase[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Flavours an item or photo can name, stemmed as `words` stems them, grouped where a photo of one is a fair example of
 * the other (a lemon tart for an olive oil citrus cake). A photo whose description names a flavour conflicts with an
 * item that names only other flavours: a chocolate cake is no example of a citrus cake. An item that names no flavour
 * (a "Birthday cake") may show any.
 */
const FLAVOUR_GROUP: ReadonlyMap<string, string> = new Map(
  (
    [
      ['chocolate', ['chocolat', 'cocoa', 'fudg', 'mocha', 'brownie']],
      ['citrus', ['citru', 'lemon', 'lime', 'orang', 'yuzu']],
      ['vanilla', ['vanilla']],
      ['berry', ['strawberri', 'berri', 'blueberri', 'raspberri', 'cherri']],
      ['carrot', ['carrot']],
      ['coffee', ['coffe', 'espresso']],
      ['matcha', ['matcha']],
      ['banana', ['banana']],
      ['apple', ['appl']],
      ['pumpkin', ['pumpkin']],
      ['coconut', ['coconut']],
    ] as const
  ).flatMap(([group, stems]) => stems.map((st) => [st, group] as const)),
);

function flavours(text: string[]): Set<string> {
  const out = new Set<string>();
  for (const w of text) {
    const g = FLAVOUR_GROUP.get(w);
    if (g) out.add(g);
  }
  return out;
}

/** Whether the photo names a flavour and the item names flavours, none of them the photo's. */
function flavourConflict(photo: LibraryPhoto, itemFlavours: ReadonlySet<string>): boolean {
  if (!itemFlavours.size) return false;
  const shown = flavours(words(photo.shows));
  if (!shown.size) return false;
  for (const f of shown) if (itemFlavours.has(f)) return false;
  return true;
}

/** Whether the photo names one of the item's flavours. */
function flavourMatch(photo: LibraryPhoto, itemFlavours: ReadonlySet<string>): boolean {
  if (!itemFlavours.size) return false;
  for (const f of flavours(words(photo.shows))) if (itemFlavours.has(f)) return true;
  return false;
}

/** FNV-1a over the item's words: picks among equally good photos the same way every time. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Score = [field: number, length: number, sameCategory: number, position: number];

const compare = (a: Score, b: Score) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

/** The best tag hit of one photo on the item: name over description over section, then the longer phrase. */
function scorePhoto(photo: LibraryPhoto, fields: [number, string[]][], category: ItemCategory): Score | null {
  let best: Score | null = null;
  for (const tag of photo.tags) {
    const phrase = words(tag);
    const length = tag.trim().length;
    for (const [weight, text] of fields) {
      const at = find(text, phrase);
      if (at < 0) continue;
      const s: Score = [weight, length, photo.category === category ? 1 : 0, -at];
      if (!best || compare(s, best) > 0) best = s;
    }
  }
  return best;
}

/** One of equally good photos: an unused one when there is one, chosen by the item's name. */
function pick(tier: LibraryPhoto[], name: string, avoid?: ReadonlySet<string>): LibraryPhoto | null {
  if (!tier.length) return null;
  const fresh = avoid ? tier.filter((p) => !avoid.has(p.id)) : tier;
  const pool = fresh.length ? fresh : tier;
  return pool[hash(words(name).join(' ')) % pool.length];
}

/** The example photo for one item, or null (keep the drawing). */
export function matchLibraryPhoto(item: MatchItem, shopKind: ShopKind, opts: MatchOptions = {}): LibraryPhoto | null {
  const library = opts.library ?? LIBRARY;
  if (!library.length) return null;
  const category = itemCategory(
    { category: isItemCategory(item.category) ? item.category : null, name: item.name, section: item.section ?? null, description: item.description ?? null },
    shopKind,
  );
  const itemFlavours = flavours([...words(item.name), ...words(item.description)]);
  const allowed = library.filter((p) => allowedForShop(p, shopKind, category) && !flavourConflict(p, itemFlavours));
  /** Among equally good photos, the ones that name the item's flavour, when any do. */
  const sameFlavour = (tier: LibraryPhoto[]) => {
    const hit = tier.filter((p) => flavourMatch(p, itemFlavours));
    return hit.length ? hit : tier;
  };

  const chosen = opts.chosenId ? allowed.find((p) => p.id === opts.chosenId) : undefined;
  if (chosen) return chosen;

  const fields: [number, string[]][] = [
    [3, words(item.name)],
    [2, words(item.description)],
    [1, words(item.section)],
  ];
  let top: Score | null = null;
  let tier: LibraryPhoto[] = [];
  for (const photo of allowed) {
    if (!compatible(category, photo.category)) continue;
    const s = scorePhoto(photo, fields, category);
    if (!s) continue;
    const c = top ? compare(s, top) : 1;
    if (c > 0) {
      top = s;
      tier = [photo];
    } else if (c === 0) tier.push(photo);
  }
  if (tier.length) return pick(sameFlavour(tier), item.name, opts.avoid);

  if (!FALLBACK.has(category)) return null;
  return pick(
    sameFlavour(allowed.filter((p) => p.category === category)),
    item.name,
    opts.avoid,
  );
}

/**
 * Every item's example photo for one shop, in menu order, keyed by item id. Items with a photo of their own get null
 * and use up nothing; two items avoid sharing a photo when another variant fits them as well. Claude's picks are
 * placed first so an automatic match steps around them.
 */
export function examplePhotos<T extends ShopItem>(
  items: readonly T[],
  shopKind: ShopKind,
  library: readonly LibraryPhoto[] = LIBRARY,
): Map<string, LibraryPhoto | null> {
  const out = new Map<string, LibraryPhoto | null>();
  const used = new Set<string>();
  const pending: T[] = [];
  for (const item of items) {
    if (item.photoUrl) {
      out.set(item.id, null);
      continue;
    }
    const chosen = item.examplePhoto && library.length ? matchLibraryPhoto(item, shopKind, { chosenId: item.examplePhoto, library }) : null;
    if (chosen && chosen.id === item.examplePhoto) {
      out.set(item.id, chosen);
      used.add(chosen.id);
    } else pending.push(item);
  }
  for (const item of pending) {
    const photo = matchLibraryPhoto(item, shopKind, { avoid: used, library });
    out.set(item.id, photo);
    if (photo) used.add(photo.id);
  }
  // Menu order for callers that iterate.
  return new Map(items.map((i) => [i.id, out.get(i.id) ?? null]));
}

/** A stored live match: `pexels:<numeric id>`. */
const PEXELS_PICK = /^pexels:(\d{1,20})$/;

/** The served file of a cached Pexels match (`src/lib/library/pexels.ts` writes it, `/i/library/[file]` serves it). */
export const pexelsFileName = (pexelsId: string) => `pexels-${pexelsId}.webp`;
export const pexelsUrl = (pexelsId: string) => `/i/library/${pexelsFileName(pexelsId)}`;

/**
 * The example photo URL for each item (null: its own photo or its drawing shows). A stored `pexels:<id>` is the cached
 * live match; anything else goes through `examplePhotos`. For people only: agents and the JSON-LD never get these.
 */
export function exampleUrls<T extends ShopItem>(
  items: readonly T[],
  shopKind: ShopKind,
  library: readonly LibraryPhoto[] = LIBRARY,
): Map<string, string | null> {
  const fromLibrary = examplePhotos(items, shopKind, library);
  return new Map(
    items.map((i) => {
      if (i.photoUrl) return [i.id, null];
      const live = i.examplePhoto?.match(PEXELS_PICK);
      if (live) return [i.id, pexelsUrl(live[1])];
      return [i.id, fromLibrary.get(i.id)?.file ?? null];
    }),
  );
}
