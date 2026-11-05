import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractMenu } from '@/lib/ai/extract';
import { normalizeExtraction } from '@/lib/ai/normalize';
import type { DraftCatalog, DraftItem } from '@/lib/domain/types';

const root = path.resolve(import.meta.dirname, '../..');
const KEY = process.env.ANTHROPIC_API_KEY;
const RECORD = process.env.RECORD_FIXTURES === '1';

async function run(sample: string, fixture: string) {
  const data = fs.readFileSync(path.join(root, 'public/samples', sample));
  const t = Date.now();
  const raw = await extractMenu([{ data, mediaType: 'image/jpeg' }]);
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  console.log(`[live] ${sample}: ${secs}s, ${raw.items.length} raw items`);
  if (RECORD) {
    fs.writeFileSync(path.join(root, 'tests/ai/fixtures', fixture), JSON.stringify(raw, null, 2) + '\n');
  }
  return { raw, catalog: normalizeExtraction(raw) };
}

function catalogOf(r: { catalog: ReturnType<typeof normalizeExtraction> }): DraftCatalog {
  if ('unreadable' in r.catalog) throw new Error(`unreadable: ${r.catalog.reason}`);
  return r.catalog;
}

const find = (c: DraftCatalog, re: RegExp): DraftItem | undefined => c.items.find((i) => re.test(i.name));
const prices = (i: DraftItem | undefined) => i?.variants.map((v) => v.priceCents);

describe.skipIf(!KEY)('live menu reader', () => {
  it('Marigold bakehouse', async () => {
    const c = catalogOf(await run('marigold-bakehouse.jpg', 'marigold.json'));
    expect(c.kind).toBe('food');
    expect(c.items.length).toBeGreaterThanOrEqual(9);
    expect(c.items.length).toBeLessThanOrEqual(12);
    const coffee = find(c, /drip coffee/i);
    expect(prices(coffee)).toEqual([300, 400]);
    expect(prices(find(c, /focaccia/i))).toContain(800);
    expect(find(c, /focaccia/i)?.issues).toContain('CHECK');
    const bun = find(c, /cardamom/i);
    expect(prices(bun)).toEqual([350]);
    expect(bun?.issues).toContain('CHECK');
    expect(find(c, /galette/i)?.issues).toContain('MARKET_PRICE');
    expect(find(c, /pain au chocolat/i)?.issues).toContain('CHECK');
  }, 120_000);

  it('Tia Lupe chalkboard', async () => {
    const c = catalogOf(await run('tia-lupe-chalkboard.jpg', 'tia-lupe.json'));
    const horchata = find(c, /horchata/i);
    expect(prices(horchata)).toEqual([300, 450]);
    expect(c.items.some((i) => i.issues.includes('MARKET_PRICE') || i.issues.includes('MISSING_PRICE'))).toBe(true);
    expect(c.skipped.some((s) => /guac/i.test(s.text))).toBe(true);
    expect(c.items.some((i) => /add guac/i.test(i.name))).toBe(false);
  }, 120_000);

  it('Ravi bike repair', async () => {
    const c = catalogOf(await run('ravi-bike-repair.jpg', 'ravi.json'));
    expect(c.items.every((i) => i.kind === 'SERVICE')).toBe(true);
    expect(c.items.length).toBeGreaterThanOrEqual(4);
  }, 120_000);

  it('blurry photo is unreadable or low confidence', async () => {
    const { raw, catalog } = await run('blurry-menu.jpg', 'blurry.json');
    if ('unreadable' in catalog) {
      expect(['unreadable', 'not_a_menu', 'no_items']).toContain(catalog.reason);
    } else {
      expect(catalog.items.every((i) => i.confidence !== 'high' || i.issues.length > 0)).toBe(true);
      expect(raw.image_quality).not.toBe('good');
    }
  }, 120_000);
});
