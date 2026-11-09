import { describe, expect, it } from 'vitest';
import type { ItemPicture } from '@/lib/domain/category';
import type { ItemWithVariants } from '@/lib/domain/types';
import { livePreview, previewPrice } from '@/lib/seller/live-preview';

const variant = (priceCents: number | null, label: string | null = null) => ({ id: `v${priceCents}${label}`, itemId: 'i', label, priceCents, sort: 0 });
const item = (id: string, status: ItemWithVariants['status'], cents: number[] = [450]) =>
  ({ id, name: `Item ${id}`, status, variants: cents.map((c) => variant(c)) }) as unknown as ItemWithVariants;
const picture = (over: Partial<ItemPicture> = {}): ItemPicture => ({ photoUrl: null, exampleUrl: null, category: 'other', ...over }) as ItemPicture;
const pictures = (entries: Record<string, Partial<ItemPicture>>) => new Map(Object.entries(entries).map(([k, v]) => [k, picture(v)]));

describe('previewPrice', () => {
  it('is the one price when there is one', () => {
    expect(previewPrice([variant(475)])).toBe('$4.75');
  });
  it('is "from" the lowest when there are several', () => {
    expect(previewPrice([variant(900, 'Large'), variant(650, 'Small')])).toBe('from $6.50');
  });
  it('ignores unpriced variants, and is empty with none priced', () => {
    expect(previewPrice([variant(null), variant(300)])).toBe('$3.00');
    expect(previewPrice([variant(null), variant(0)])).toBe('');
  });
});

describe('livePreview', () => {
  it('takes the first three live items, in menu order, leaving out the ask-in-person ones', () => {
    const items = [item('a', 'in_person'), item('b', 'live'), item('c', 'live'), item('d', 'draft'), item('e', 'live'), item('f', 'live')];
    const p = livePreview(items, pictures({ b: {}, c: {}, e: {}, f: {} }), null);
    expect(p.rows.map((r) => r.id)).toEqual(['b', 'c', 'e']);
    expect(p.rows[0]).toMatchObject({ name: 'Item b', price: '$4.50' });
  });
  it('leads with the cover when the shop has one', () => {
    const p = livePreview([item('a', 'live')], pictures({ a: { photoUrl: '/i/a.webp' } }), '/i/cover.webp');
    expect(p.hero).toEqual({ kind: 'cover', src: '/i/cover.webp' });
  });
  it('with no cover, prefers the first item with the seller\'s own photo over an earlier example', () => {
    const items = [item('a', 'live'), item('b', 'live')];
    const p = livePreview(items, pictures({ a: { exampleUrl: '/library/a.webp' }, b: { photoUrl: '/i/b.webp' } }), null);
    expect(p.hero).toMatchObject({ kind: 'item', item: { id: 'b' } });
  });
  it('falls back to the first live item, whatever its picture, and to nothing when no item is live', () => {
    expect(livePreview([item('a', 'live')], pictures({ a: {} }), null).hero).toMatchObject({ kind: 'item', item: { id: 'a' } });
    expect(livePreview([item('a', 'in_person')], pictures({ a: {} }), null).hero).toBeNull();
  });
  it('sends only what the card draws: a plain, serialisable row', () => {
    const p = livePreview([item('a', 'live')], pictures({ a: { exampleUrl: '/library/a.webp' } }), null);
    expect(JSON.parse(JSON.stringify(p.rows[0]))).toEqual(p.rows[0]);
    expect(p.rows[0].picture.exampleUrl).toBe('/library/a.webp');
  });
});
