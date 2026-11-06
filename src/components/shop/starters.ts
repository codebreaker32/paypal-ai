// Starter prompts for an empty buyer console, made from the shop's real menu.
import type { ItemWithVariants, Shop } from '@/lib/domain/types';

const priced = (i: ItemWithVariants) => i.variants.filter((v) => v.priceCents !== null && v.priceCents > 0);
const orderable = (i: ItemWithVariants) => i.status === 'live' && !i.soldOut && priced(i).length > 0;
/** Names that read well inside a sentence: letters and spaces, at most three words. */
const simple = (i: ItemWithVariants) => /^[\p{L} ]+$/u.test(i.name) && i.name.trim().split(/\s+/).length <= 3;

const lower = (s: string) => s.trim().toLowerCase();
const article = (phrase: string) => (/^[aeiou]/i.test(phrase) ? 'an' : 'a');

function pluralLast(phrase: string): string {
  const words = phrase.split(' ');
  const w = words.pop()!;
  const plural =
    /fe$/.test(w) ? `${w.slice(0, -2)}ves`
    : /[^f]f$/.test(w) ? `${w.slice(0, -1)}ves`
    : /(s|x|z|ch|sh)$/.test(w) ? `${w}es`
    : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies`
    : `${w}s`;
  return [...words, plural].join(' ');
}

/** "Cakes (24h notice)" → "cakes"; "Menu" or nothing → null. */
function sectionWord(section: string | null | undefined): string | null {
  const s = section?.replace(/\(.*?\)/g, '').trim();
  return s && lower(s) !== 'menu' ? lower(s) : null;
}

export function starterPrompts(shop: Pick<Shop, 'kind' | 'fulfillment'>, items: ItemWithVariants[]): string[] {
  const live = items.filter(orderable);
  const single = live.filter((i) => priced(i).length === 1);
  const pool = single.filter(simple).length ? single.filter(simple) : single;

  // The busiest section's first item, then one from another section.
  const sections = [...new Set(live.map((i) => i.section ?? ''))];
  const busiest = sections.reduce<string | null>((best, s) => {
    const count = (x: string | null) => (x === null ? -1 : live.filter((i) => (i.section ?? '') === x).length);
    return count(s) > count(best) ? s : best;
  }, null);
  const a = pool.find((i) => (i.section ?? '') === busiest) ?? pool[0];
  const b = a && pool.find((i) => i.id !== a.id && (i.section ?? '') !== (a.section ?? ''));
  const ships = shop.fulfillment !== 'pickup';

  const prompts: string[] = [];
  if (a) {
    if (shop.kind === 'services') {
      prompts.push(`I’d like ${article(a.name)} ${lower(a.name)}. How does it work?`);
    } else {
      const second = b ? ` and ${article(b.name)} ${lower(b.name)}` : '';
      prompts.push(`Two ${pluralLast(lower(a.name))}${second}, ${ships ? 'shipped to me' : 'for pickup'}`);
    }
  }

  const word = sectionWord((a ?? items.find((i) => i.status === 'live' || i.status === 'in_person'))?.section);
  prompts.push(word ? `What ${word} do you have?` : "What’s on the menu today?");

  const sized = live.find((i) => priced(i).length > 1);
  if (sized) prompts.push(`What sizes does the ${lower(sized.name)} come in?`);
  else prompts.push(shop.fulfillment === 'shipping' ? 'How much is shipping?' : 'When and where is pickup?');

  return prompts.slice(0, 3);
}
