import type { ShopKind } from './types';

/**
 * The pictures Shelfie draws for an item with no photo of its own (src/components/illustrations). Claude picks one per
 * item when it reads the menu; rows without one (older shops, the demo seed) fall back to `guessCategory`.
 */
export const CATEGORIES = ['bread', 'pastry', 'cake', 'coffee', 'tea', 'taco', 'burrito', 'drink', 'dessert', 'bike_part', 'tool', 'goods'] as const;
export type ItemCategory = (typeof CATEGORIES)[number];

export const isItemCategory = (value: unknown): value is ItemCategory => typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);

/**
 * Keyword rules, checked in order: specific before general ("coffee cake" is a cake, "chai latte" is tea, a services
 * shop's "flat fix" is a repair, not a part). Whole words only, plurals allowed.
 */
const RULES: [ItemCategory, RegExp][] = [
  ['burrito', /\b(burritos?|enchiladas?|wraps?|chimichangas?)\b/],
  ['taco', /\b(tacos?|al pastor|carnitas|quesadillas?|tostadas?|nachos)\b/],
  ['cake', /\b(cakes?|cheesecakes?|cupcakes?|tres leches|gateaux?|torte)\b/],
  ['pastry', /\b(croissants?|pain au chocolat|danish(es)?|scones?|muffins?|buns?|cinnamon rolls?|galettes?|tarts?|turnovers?|eclairs?|conchas?|kouign amann|brioches?|strudel|pastr(y|ies)|viennoiserie)\b/],
  ['bread', /\b(breads?|loa(f|ves)|sourdough|rye|baguettes?|focaccia|ciabatta|bagels?|rolls?|boules?|batards?|challah|pita|naan|bolillos?|tortillas?)\b/],
  ['dessert', /\b(flan|churros?|cookies?|brownies?|ice cream|gelato|sorbet|paletas?|puddings?|mousse|pies?|desserts?|sweets?|cobbler|sundaes?|donuts?|doughnuts?|macarons?)\b/],
  ['tea', /\b(teas?|chai|matcha|earl grey|chamomile|oolong|rooibos|herbal)\b/],
  ['coffee', /\b(coffees?|espresso|lattes?|cappuccinos?|americanos?|cortados?|mochas?|macchiatos?|flat white|cold brew|drip|pour over)\b/],
  ['drink', /\b(horchata|jarritos|agua fresca|aguas? frescas?|juices?|sodas?|lemonades?|smoothies?|kombucha|water|drinks?|beverages?|milkshakes?|shakes?|cocoa|hot chocolate|jamaica|limonada)\b/],
  ['tool', /\b(fix(es)?|tune ups?|tuneups?|repairs?|service|servicing|check|checkups?|indexing|adjust(ment)?s?|true|truing|install(ation)?|replace(ment)?|labou?r|overhaul|bleed|fitting|tools?|wrench(es)?)\b/],
  ['bike_part', /\b(tubes?|tires?|tyres?|chains?|brakes?|pedals?|saddles?|spokes?|derailleurs?|cassettes?|wheels?|handlebars?|cables?|pads?|grips?|bikes?|bicycles?|cycling|700c|26in|29er|helmets?|lights?|locks?)\b/],
];

/** Lower-case, accents dropped, punctuation turned into spaces: "Tune-up" and "tune up" match the same rule. */
const plain = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

function match(text: string | null | undefined): ItemCategory | null {
  if (!text) return null;
  const words = ` ${plain(text)} `;
  for (const [category, rule] of RULES) if (rule.test(words)) return category;
  return null;
}

/**
 * The best-fitting picture for an item from its words alone: the name first, then its description, then its section
 * heading. A services shop's unmatched item is a job (`tool`); anything else falls back to `goods`.
 */
export function guessCategory(input: { name: string; section?: string | null; description?: string | null; shopKind: ShopKind }): ItemCategory {
  const found = match(input.name) ?? match(input.description) ?? match(input.section);
  if (found) return found;
  return input.shopKind === 'services' ? 'tool' : 'goods';
}

/** The item's stored category when it has a known one, else the keyword guess. */
export function itemCategory(
  item: { category: ItemCategory | null; name: string; section: string | null; description: string | null },
  shopKind: ShopKind,
): ItemCategory {
  if (isItemCategory(item.category)) return item.category;
  return guessCategory({ name: item.name, section: item.section, description: item.description, shopKind });
}
