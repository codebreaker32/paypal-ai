import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeExtraction, retakeTipFor } from '@/lib/ai/normalize';
import { MenuExtractionSchema, type ExtractedItem, type MenuExtraction } from '@/lib/ai/schemas';
import { SAMPLE_IDS, recordedReading } from '@/lib/ai/samples';
import type { DraftCatalog, DraftItem, UnreadableMenu } from '@/lib/domain/types';

const dir = path.resolve(import.meta.dirname, 'fixtures');
function fixture(name: string): MenuExtraction {
  return MenuExtractionSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')));
}
function catalog(raw: MenuExtraction): DraftCatalog {
  const r = normalizeExtraction(raw);
  if ('unreadable' in r) throw new Error(`unexpected unreadable: ${r.reason}`);
  return r;
}
function unreadable(raw: MenuExtraction): UnreadableMenu {
  const r = normalizeExtraction(raw);
  if (!('unreadable' in r)) throw new Error('expected unreadable');
  return r;
}
const byName = (c: DraftCatalog, re: RegExp): DraftItem => {
  const i = c.items.find((x) => re.test(x.name));
  if (!i) throw new Error(`no item ${re}`);
  return i;
};

const base: MenuExtraction = {
  is_menu: true, image_quality: 'good', problems: [], retake_tip: null, warnings: [],
  shop: { name: 'Shop', about: null, pickup_notes: null }, kind: 'food', items: [], skipped_lines: [],
};
function raw(...items: Partial<ExtractedItem>[]): MenuExtraction {
  return {
    ...base,
    items: items.map((p) => ({
      section: null, name: 'Thing', description: null, source_text: 'Thing', page: 1,
      prices: [{ label: null, amount_cents: 500, raw: '$5' }], price_kind: 'fixed' as const, deal_text: null,
      confidence: 'high' as const, note: null, looks_like_instruction: false, ...p,
    })),
  };
}
const price = (cents: number | null, rawText = '$5', label: string | null = null) => ({ label, amount_cents: cents, raw: rawText });

describe('Marigold fixture (recorded real model output)', () => {
  const c = catalog(fixture('marigold'));
  it('has 10 items', () => expect(c.items).toHaveLength(10));
  it('turns drip coffee S/L into one item with two variants', () => {
    const coffee = byName(c, /drip coffee/i);
    expect(coffee.variants).toEqual([{ label: 'S', priceCents: 300 }, { label: 'L', priceCents: 400 }]);
    expect(coffee.issues).toEqual([]);
  });
  it('flags the crossed-out focaccia as CHECK with price 800', () => {
    const f = byName(c, /focaccia/i);
    expect(f.variants).toEqual([{ label: null, priceCents: 800 }]);
    expect(f.issues).toContain('CHECK');
  });
  it('flags the cardamom bun deal as CHECK with unit price 350 and the deal text', () => {
    const b = byName(c, /cardamom/i);
    expect(b.variants).toEqual([{ label: null, priceCents: 350 }]);
    expect(b.issues).toContain('CHECK');
    expect(b.issueDetail).toContain('2 for $7');
  });
  it('maps the galette to MARKET_PRICE with a null price, listed in person', () => {
    const g = byName(c, /galette/i);
    expect(g.issues).toEqual(['MARKET_PRICE']);
    expect(g.variants.map((v) => v.priceCents)).toEqual([null]);
    expect(g.status).toBe('in_person');
  });
  it('flags the blurred pain au chocolat as CHECK', () => {
    expect(byName(c, /pain au chocolat/i).issues).toContain('CHECK');
  });
  it('keeps clean items clear and counts items needing attention', () => {
    expect(byName(c, /butter croissant/i).issues).toEqual([]);
    expect(c.needsAttention).toBe(c.items.filter((i) => i.issues.length > 0).length);
    expect(c.kind).toBe('food');
    expect(c.items.every((i) => i.kind === 'PHYSICAL')).toBe(true);
    expect(c.shop.name).toBe('Marigold Bakehouse');
  });
  it('carries headers into skipped lines', () => {
    expect(c.skipped.some((s) => s.text === 'Breads' && s.reason === 'header')).toBe(true);
  });
});

describe('other recorded fixtures', () => {
  it('Tia Lupe: horchata variants, "?" as market, add-on skipped, nothing invented', () => {
    const c = catalog(fixture('tia-lupe'));
    expect(byName(c, /horchata/i).variants).toEqual([{ label: 'sm', priceCents: 300 }, { label: 'lg', priceCents: 450 }]);
    expect(byName(c, /agua fresca/i).issues).toEqual(['MARKET_PRICE']);
    expect(c.skipped.some((s) => /guac/i.test(s.text) && s.reason === 'addon')).toBe(true);
    expect(c.items.some((i) => /add guac/i.test(i.name))).toBe(false);
  });
  it('Ravi: services kind, non-plain prices flagged CHECK', () => {
    const c = catalog(fixture('ravi'));
    expect(c.kind).toBe('services');
    expect(c.items.every((i) => i.kind === 'SERVICE')).toBe(true);
    expect(byName(c, /chain replace/i).issues).toContain('CHECK');
    expect(byName(c, /full tune-up/i).issues).toEqual([]);
  });
  it('blurry: unreadable with a blurry tip', () => {
    const r = unreadable(fixture('blurry'));
    expect(r.reason).toBe('unreadable');
    expect(r.tip).toContain('Hold steady and tap to focus');
  });
});

describe('price rules', () => {
  it('flags price 0 and 150000 cents (> $1,000) as CHECK, but not 100000', () => {
    const c = catalog(raw(
      { name: 'Zero', prices: [price(0, '$0')] },
      { name: 'Huge', prices: [price(150000, '$1500')] },
      { name: 'Edge', prices: [price(100000, '$1000')] },
    ));
    expect(byName(c, /Zero/).issues).toContain('CHECK');
    expect(byName(c, /Huge/).issues).toContain('CHECK');
    expect(byName(c, /Edge/).issues).toEqual([]);
  });
  it('treats negative and non-integer amounts as unusable', () => {
    const c = catalog(raw({ name: 'Neg', prices: [price(-100, '-1')] }, { name: 'Frac', prices: [price(450.5, '4.505')] }));
    expect(byName(c, /Neg/).issues).toContain('CHECK');
    expect(byName(c, /Frac/).variants[0].priceCents).toBeNull();
    expect(byName(c, /Frac/).issues).toContain('CHECK');
  });
  it('missing price kind or null amount on a fixed item → MISSING_PRICE', () => {
    const c = catalog(raw(
      { name: 'A', prices: [], price_kind: 'missing' },
      { name: 'B', prices: [price(null, 'smudge')] },
    ));
    expect(byName(c, /^A$/).issues).toEqual(['MISSING_PRICE']);
    expect(byName(c, /^A$/).variants).toEqual([{ label: null, priceCents: null }]);
    expect(byName(c, /^B$/).issues).toEqual(['MISSING_PRICE']);
  });
  it('cross-checks raw text only when amount_cents is null and raw looks numeric', () => {
    const c = catalog(raw({ name: 'A', prices: [price(null, '4.5')] }, { name: 'B', prices: [price(null, 'ask')] }));
    expect(byName(c, /^A$/).variants[0].priceCents).toBe(450);
    expect(byName(c, /^B$/).variants[0].priceCents).toBeNull();
  });
  it('low confidence → CHECK; medium with a crossed-out/blurred note → CHECK; plain medium stays clear', () => {
    const c = catalog(raw(
      { name: 'Low', confidence: 'low' },
      { name: 'Med', confidence: 'medium', note: 'Price is crossed out' },
      { name: 'Plain', confidence: 'medium', note: 'Matched by row position' },
    ));
    expect(byName(c, /Low/).issues).toContain('CHECK');
    expect(byName(c, /Med/).issues).toContain('CHECK');
    expect(byName(c, /Plain/).issues).toEqual([]);
  });
  it('a deal suggests the unit price in the detail', () => {
    const c = catalog(raw({ name: 'Bun', price_kind: 'deal', deal_text: '2 for $7', prices: [price(350, '2 for $7')] }));
    const b = byName(c, /Bun/);
    expect(b.issues).toEqual(['CHECK']);
    expect(b.issueDetail).toBe('Printed as “2 for $7”. We set $3.50 each. Is that right?');
  });
  it('market price items with a stray amount still keep a null price', () => {
    const c = catalog(raw({ name: 'Fish', price_kind: 'market', prices: [price(null, 'MP')] }));
    expect(byName(c, /Fish/).issues).toEqual(['MARKET_PRICE']);
  });
});

// What the seller reads on a flagged card: fixed plain sentences filled with the item's own data,
// never the model's free-text note (it talks about cents, fields and how it matched rows).
const ENGINEER_TALK = /cents|row position|by row|matched by|unit price|confidence|best reading|amount_cents|price_kind|deal_text|source_text/i;
const DOUBLED_PUNCTUATION = /[.?!][.?!]/;

describe('seller-facing issue text', () => {
  const detail = (item: Partial<ExtractedItem>) => catalog(raw(item)).items[0].issueDetail;
  const modelNote = 'Multi-buy deal; unit price is 350 cents. Matched by row position.';

  it('deal: names what was printed, the price we set and asks one question', () => {
    expect(detail({ price_kind: 'deal', deal_text: '2 for $7', prices: [price(350, '2 for $7')], note: modelNote }))
      .toBe('Printed as “2 for $7”. We set $3.50 each. Is that right?');
  });
  it('deal with no unit price asks what one costs', () => {
    const item = catalog(raw({ price_kind: 'deal', deal_text: '3 for $10', prices: [price(null, '3 for $10')] })).items[0];
    expect(item.issues).toContain('MISSING_PRICE');
    expect(item.issueDetail).toBe('Printed as “3 for $10”. What does one cost?');
  });
  it('no price on the menu', () => {
    expect(detail({ price_kind: 'missing', prices: [], note: 'No price listed; amount_cents is null.' }))
      .toBe('No price on the menu. Add one, or leave it off.');
  });
  it('a price we could not read', () => {
    expect(detail({ prices: [price(null, 'smudge')], note: 'Price smudged; amount_cents null.' }))
      .toBe('We couldn’t read the price. Add one, or leave it off.');
  });
  it('one size we could not read', () => {
    expect(detail({ prices: [price(300, '$3', 'S'), price(null, '?', 'L')] }))
      .toBe('We couldn’t read the L price. Add it, or leave the item off.');
  });
  it('market price quotes what the menu says (the card itself offers today’s price or ask in person)', () => {
    expect(detail({ price_kind: 'market', prices: [price(null, 'market price')] }))
      .toBe('Your menu says “market price” instead of a price.');
    expect(detail({ price_kind: 'market', prices: [] })).toBe('Your menu says market price instead of a price.');
  });
  it('crossed-out price', () => {
    expect(detail({ prices: [price(800, '$7 $8')], confidence: 'medium', note: '$7 is crossed out and replaced with $8; using $8.' }))
      .toBe('A price is crossed out. We set $8.00. Is that right?');
  });
  it('printed in an unusual way', () => {
    expect(detail({ prices: [price(2000, 'from $20')] })).toBe('Printed as “from $20”. We set $20.00. Is that right?');
  });
  it('hard to read', () => {
    expect(detail({ prices: [price(475, '$4.75')], confidence: 'low', note: 'Name and price are blurred; best reading.' }))
      .toBe('Hard to read in the photo. Are the name and price right?');
  });
  it('an unusual amount', () => {
    expect(detail({ prices: [price(0, '$0')] })).toBe('We set $0.00, which looks unusual. Is that right?');
    expect(detail({ prices: [price(1000, '$10', 'else'), price(0, 'FREE', 'w/ tune-up')] }))
      .toBe('We set $0.00 for “w/ tune-up”, which looks unusual. Is that right?');
  });
  it('a single price leaves its label out of the sentence', () => {
    expect(detail({ deal_text: 'FREE w/ tune-up, else $10', prices: [price(1000, 'FREE w/ tune-up, else $10', 'else')] }))
      .toBe('Printed as “FREE w/ tune-up, else $10”. We set $10.00. Is that right?');
  });
  it('sizes keep their labels', () => {
    expect(detail({ prices: [price(300, '3ish', 'S'), price(400, '$4', 'L')] }))
      .toBe('Printed as “3ish”. We set S $3.00 and L $4.00. Is that right?');
  });
  it('a deal that is not a multi-buy does not say "each"', () => {
    expect(detail({ price_kind: 'deal', deal_text: 'FREE w/ tune-up, else $10', prices: [price(1000, 'FREE w/ tune-up, else $10')] }))
      .toBe('Printed as “FREE w/ tune-up, else $10”. We set $10.00. Is that right?');
  });
  it('an amount that is not a usable price', () => {
    expect(detail({ prices: [price(450.5, '4.505')] })).toBe('We couldn’t read “4.505” as a price. Add the right one, or leave it off.');
  });
  it('lists every price of an item listed twice', () => {
    const c = catalog(raw(
      { name: 'Latte', prices: [price(425, '$4.25')] },
      { name: 'Latte', prices: [price(475, '$4.75')], page: 2 },
    ));
    expect(c.items.map((i) => i.issueDetail)).toEqual([
      'Listed twice with different prices: $4.25 and $4.75.',
      'Listed twice with different prices: $4.25 and $4.75.',
    ]);
  });
  it('a plain item has no detail, even with a model note', () => {
    expect(detail({ confidence: 'medium', note: 'Price matched by row position.' })).toBeNull();
  });
  it('never shows the model note, engineer talk or doubled punctuation', () => {
    const c = catalog(raw(
      { name: 'A', price_kind: 'deal', deal_text: '2 for $7', prices: [price(350, '2 for $7')], confidence: 'low', note: modelNote },
      { name: 'B', prices: [price(null, 'x')], note: 'Unit price unclear; confidence low.' },
      { name: 'C', prices: [price(900, '$9.')], confidence: 'low', note: 'Matched by row position.' },
      { name: 'D', price_kind: 'market', prices: [price(null, 'MP')], note: 'market; amount_cents null' },
    ));
    for (const i of c.items) {
      expect(i.issueDetail).not.toBeNull();
      expect(i.issueDetail).not.toMatch(ENGINEER_TALK);
      expect(i.issueDetail).not.toMatch(DOUBLED_PUNCTUATION);
    }
  });
});

describe('notes from the reading (shop-level warnings)', () => {
  const warningsOf = (warnings: string[]) => catalog({ ...raw({}), warnings }).warnings;
  const CHECK_PHOTO = 'Check the names and prices against your photo before you publish.';

  it('keeps a plain note as written', () => {
    expect(warningsOf(['Glare on the right side of the page.'])).toEqual(['Glare on the right side of the page.']);
  });
  it('replaces method talk with one fixed sentence', () => {
    expect(warningsOf([
      'Prices sit far from item names, so the matching of prices to items was done by row position; please verify.',
      'Cardamom bun: unit price is 350 cents.',
      'Pain au chocolat confidence is low; amount_cents may be wrong.',
      'Best reading of a blurred line.',
    ])).toEqual([CHECK_PHOTO]);
  });
  it('keeps plain notes beside the fixed sentence, which comes last', () => {
    expect(warningsOf(['Price matched by row.', 'Glare on the right side of the page.'])).toEqual([
      'Glare on the right side of the page.',
      CHECK_PHOTO,
    ]);
  });
  it('uses curly apostrophes, like the rest of the app', () => {
    expect(warningsOf(["The prices don't line up with the names."])).toEqual(['The prices don’t line up with the names.']);
  });
  it('drops doubled punctuation and repeated notes', () => {
    expect(warningsOf(['Is the galette price right?.', 'Is the galette price right?', ''])).toEqual(['Is the galette price right?']);
  });
});

describe('recorded sample readings (what a keyless visitor sees)', () => {
  for (const id of SAMPLE_IDS) {
    it(`${id}: flagged cards and notes are plain`, () => {
      const c = catalog(recordedReading(id));
      for (const t of [...c.items.map((i) => i.issueDetail ?? ''), ...c.warnings]) {
        expect(t).not.toMatch(ENGINEER_TALK);
        expect(t).not.toMatch(DOUBLED_PUNCTUATION);
      }
    });
    it(`${id}: the recording itself is written for a shop owner`, () => {
      const r = recordedReading(id);
      for (const t of [...r.items.map((i) => i.note ?? ''), ...r.warnings]) expect(t).not.toMatch(ENGINEER_TALK);
    });
  }
  it('Marigold keeps the demo flags: the deal, the crossed-out price and the market price', () => {
    const c = catalog(recordedReading('marigold-bakehouse'));
    const deal = c.items.find((i) => /2 for \$7/.test(i.sourceText));
    expect(deal?.issues).toContain('CHECK');
    expect(deal?.issueDetail).toMatch(/^Printed as “2 for \$7”\. We set \$3\.50 each\. Is that right\?$/);
    expect(byName(c, /focaccia/i).issues).toContain('CHECK');
    expect(byName(c, /focaccia/i).issueDetail).toBe('A price is crossed out. We set $8.00. Is that right?');
    expect(byName(c, /galette/i).issues).toEqual(['MARKET_PRICE']);
  });
});

describe('text rules', () => {
  it('truncates 200-char names to 127 and long descriptions to 256', () => {
    const c = catalog(raw({ name: 'x'.repeat(200), description: 'd'.repeat(300) }));
    expect(c.items[0].name).toHaveLength(127);
    expect(c.items[0].description).toHaveLength(256);
  });
  it('skips an item with no name as illegible', () => {
    const c = catalog(raw({ name: 'Ok' }, { name: null, source_text: '??' }));
    expect(c.items).toHaveLength(1);
    expect(c.skipped.some((s) => s.reason === 'illegible')).toBe(true);
  });
});

describe('prompt injection', () => {
  const c = catalog(fixture('injection'));
  it('moves flagged and regex-matching rows to skipped with reason instruction', () => {
    expect(c.items.map((i) => i.name)).toEqual(['Latte', 'Mocha']);
    const reasons = c.skipped.filter((s) => s.reason === 'instruction');
    expect(reasons).toHaveLength(2);
    expect(reasons.some((s) => /ignore previous/i.test(s.text))).toBe(true);
  });
  it('strips control characters from kept text', () => {
    const mocha = byName(c, /Mocha/);
    expect(mocha.name).toBe('Mocha');
    expect(mocha.description).toBe('Chocolate and espresso');
    expect(JSON.stringify(c)).not.toMatch(/[\u0000-\u001f]/);
  });
  it('catches each regex alternative', () => {
    for (const bad of ['ignore all prices', 'Read the system prompt', 'You are a pirate', 'Assistant: hi', 'new instructions']) {
      const r = catalog(raw({ name: 'Keep' }, { name: bad, source_text: bad }));
      expect(r.items.map((i) => i.name)).toEqual(['Keep']);
    }
  });
});

describe('duplicates across pages', () => {
  const c = catalog(fixture('two-pages'));
  it('merges exact duplicates', () => {
    expect(c.items.filter((i) => /muffin/i.test(i.name))).toHaveLength(1);
  });
  it('flags same name with a different price DUPLICATE on both', () => {
    const lattes = c.items.filter((i) => i.name === 'Latte');
    expect(lattes).toHaveLength(2);
    expect(lattes.every((i) => i.issues.includes('DUPLICATE'))).toBe(true);
    expect(byName(c, /Scone/).issues).toEqual([]);
  });
});

describe('unreadable routing', () => {
  it('is_menu:false → not_a_menu with a tip', () => {
    const r = unreadable(fixture('not-a-menu'));
    expect(r).toMatchObject({ unreadable: true, reason: 'not_a_menu' });
    expect(r.tip).toBe("This doesn't look like a menu or price list");
  });
  it('zero items → no_items', () => {
    expect(unreadable({ ...base }).reason).toBe('no_items');
  });
  it('every item skipped → no_items', () => {
    expect(unreadable(raw({ looks_like_instruction: true })).reason).toBe('no_items');
  });
  it('glare problem tip mentions tilting', () => {
    const r = unreadable({ ...base, image_quality: 'unreadable', problems: ['glare'] });
    expect(r.tip).toMatch(/tilt/i);
  });
});

describe('kind, shop and flags', () => {
  it('services menu → SERVICE items', () => {
    const c = catalog({ ...raw({ name: 'Tune' }), kind: 'services' });
    expect(c.kind).toBe('services');
    expect(c.items[0].kind).toBe('SERVICE');
  });
  it('passes warnings through and reports non_usd', () => {
    const c = catalog({ ...raw({}), problems: ['non_usd'], warnings: ['prices in euros'] });
    expect(c.nonUsd).toBe(true);
    expect(c.warnings).toEqual(['prices in euros']);
  });
  it('null shop fields become empty strings', () => {
    expect(catalog(raw({})).shop).toEqual({ name: 'Shop', about: '', pickupNotes: '' });
  });
});

describe('retakeTipFor', () => {
  it('maps each problem to its tip', () => {
    expect(retakeTipFor(['blurry'])).toBe('Hold steady and tap to focus');
    expect(retakeTipFor(['glare'])).toBe("Tilt the phone so the light doesn't bounce off");
    expect(retakeTipFor(['cropped'])).toBe('Fit the whole menu in the frame, or add another photo');
    expect(retakeTipFor(['dark'])).toBe('Move closer to a light');
    expect(retakeTipFor(['not_a_menu'])).toBe("This doesn't look like a menu or price list");
  });
  it('combines multiple and falls back when none apply', () => {
    expect(retakeTipFor(['blurry', 'dark'])).toBe('Hold steady and tap to focus. Move closer to a light');
    expect(retakeTipFor([])).toMatch(/another photo/i);
    expect(retakeTipFor(['non_usd'])).toMatch(/another photo/i);
  });
});
