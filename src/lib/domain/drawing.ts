import type { ItemCategory } from './category';

/**
 * Drawings within a category, chosen from the item's name: a bakery's buns, tarts and pains au chocolat should not all
 * be the same croissant, nor its sourdough, baguette and focaccia the same loaf. The category itself stays Claude's
 * closed choice (`CATEGORIES`); this only varies the picture.
 */
export const PASTRY_VARIANTS = ['croissant', 'bun', 'tart', 'pain'] as const;
export type PastryVariant = (typeof PASTRY_VARIANTS)[number];

/** Checked in order: a croissant stays a croissant whatever else its name says ("Cinnamon sugar croissant"). */
const PASTRY_RULES: [PastryVariant, RegExp][] = [
  ['croissant', /\bcroissants?\b/],
  ['pain', /\b(pains? au chocolat|chocolatines?|eclairs?|strudels?)\b/],
  ['tart', /\b(tarts?|tartlets?|tartes?|pies?|galettes?|quiches?|crostatas?|danish(es)?|frangipanes?)\b/],
  ['bun', /\b(buns?|rolls?|cinnamon|cardamom|swirls?|knots?|brioches?|conchas?|kanelbullar|kardemummabullar|pain aux raisins|escargots?)\b/],
];

const plain = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

/** Which pastry drawing an item's name asks for; the croissant when nothing matches. */
export function pastryVariant(name: string): PastryVariant {
  const words = ` ${plain(name)} `;
  for (const [variant, rule] of PASTRY_RULES) if (rule.test(words)) return variant;
  return 'croissant';
}

export const BREAD_VARIANTS = ['loaf', 'boule', 'baguette', 'focaccia'] as const;
export type BreadVariant = (typeof BREAD_VARIANTS)[number];

/** Checked in order, shape before dough: a "Sourdough baguette" is long and a "Sourdough focaccia" is flat. */
const BREAD_RULES: [BreadVariant, RegExp][] = [
  ['focaccia', /\b(focaccias?|schiacciatas?|fougasses?|pizza bianca|flatbreads?)\b/],
  ['baguette', /\b(baguettes?|batards?|ficelles?|epis?|french sticks?|demi baguettes?)\b/],
  ['boule', /\b(sourdough|boules?|miches?|levain|pain de campagne|campagne|country|cob|round)\b/],
];

/** Which bread drawing an item's name asks for; the tin loaf when nothing matches. */
export function breadVariant(name: string): BreadVariant {
  const words = ` ${plain(name)} `;
  for (const [variant, rule] of BREAD_RULES) if (rule.test(words)) return variant;
  return 'loaf';
}

/** Every symbol id in public/illustrations.svg: one per category, plus the bread and pastry variants. */
export const DRAWING_IDS = [
  'bread',
  'bread-boule',
  'bread-baguette',
  'bread-focaccia',
  'pastry',
  'pastry-bun',
  'pastry-tart',
  'pastry-pain',
  'cake',
  'coffee',
  'tea',
  'taco',
  'burrito',
  'drink',
  'dessert',
  'meal',
  'bike_part',
  'tool',
  'goods',
] as const;
export type DrawingId = (typeof DRAWING_IDS)[number];

/** The symbol in public/illustrations.svg for an item: its category's drawing, or a variant of it picked by its name. */
export function drawingId(category: ItemCategory, name?: string | null): DrawingId {
  if (category === 'pastry' && name) {
    const variant = pastryVariant(name);
    return variant === 'croissant' ? 'pastry' : `pastry-${variant}`;
  }
  if (category === 'bread' && name) {
    const variant = breadVariant(name);
    return variant === 'loaf' ? 'bread' : `bread-${variant}`;
  }
  return category;
}
