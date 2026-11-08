// The "Listed twice" card: answering it settles which copies stay, never an item's own question.
import { describe, expect, it } from 'vitest';
import { applyLocal, duplicateUpdates, flaggedCards, withNewItem } from '@/components/setup/review-model';
import type { IssueCode, ItemWithVariants } from '@/lib/domain/types';

const SHAKY = 'Hard to read in the photo. Are the name and price right?';
const TWICE = 'Listed twice with different prices: $450.00 and $40.00.';

const item = (id: string, priceCents: number, issues: IssueCode[], issueDetail: string): ItemWithVariants => ({
  id, shopId: 'shp_1', section: 'Gifts', name: 'Gift box', description: null, sourceText: `Gift box ${priceCents / 100}`,
  confidence: 'high', issues, issueDetail, kind: 'PHYSICAL', status: 'draft', soldOut: false, photoUrl: null, category: null, examplePhoto: null, sort: 0,
  paypalProductId: null, publishedAt: null, updatedAt: '2026-11-06T00:00:00Z',
  variants: [{ id: `${id}-v0`, itemId: id, label: null, priceCents, sort: 0 }],
});

const giftBoxes = () => [item('a', 45_000, ['CHECK', 'DUPLICATE'], SHAKY), item('b', 4_000, ['DUPLICATE'], TWICE)];
const apply = (items: ItemWithVariants[], updates: ReturnType<typeof duplicateUpdates>) =>
  updates.reduce((all, u) => all.map((it) => (it.id === u.itemId ? applyLocal(it, u) : it)), items);

describe('the "Listed twice" card', () => {
  it('shows two Gift box rows as one card', () => {
    const cards = flaggedCards(giftBoxes());
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('duplicate');
  });

  it('keeping the $450 one removes the twin and still asks its own question', () => {
    const [big, small] = giftBoxes();
    const after = apply([big, small], duplicateUpdates([big, small], big));
    expect(after.find((i) => i.id === 'b')!.status).toBe('removed');
    expect(after.find((i) => i.id === 'a')!.issues).toEqual(['CHECK']);
    const cards = flaggedCards(after);
    expect(cards).toEqual([{ kind: 'single', item: expect.objectContaining({ id: 'a', issueDetail: SHAKY }) }]);
  });

  it('keeping the $40 one clears the card', () => {
    const [big, small] = giftBoxes();
    const after = apply([big, small], duplicateUpdates([big, small], small));
    expect(after.find((i) => i.id === 'a')!.status).toBe('removed');
    expect(after.find((i) => i.id === 'b')!.issues).toEqual([]);
    expect(flaggedCards(after)).toEqual([]);
  });

  it('keeping both leaves only its own question', () => {
    const after = apply(giftBoxes(), duplicateUpdates(giftBoxes(), 'all'));
    expect(after.map((i) => i.issues)).toEqual([['CHECK'], []]);
    expect(flaggedCards(after).map((c) => (c.kind === 'single' ? c.item.id : null))).toEqual(['a']);
  });

  it('sends the kept item last, so the card counts as answered once everything is queued', () => {
    const [big, small] = giftBoxes();
    expect(duplicateUpdates([big, small], big).map((u) => u.itemId)).toEqual(['b', 'a']);
  });
});

describe('adding a skipped line to the list', () => {
  it('appends a new item', () => {
    const [a, b] = giftBoxes();
    expect(withNewItem([a], b).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps one row when a server refresh already brought the item', () => {
    const [a, b] = giftBoxes();
    const all = [a, b];
    expect(withNewItem(all, b)).toBe(all);
  });
});
