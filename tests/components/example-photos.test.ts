// Part A3: an item with no photo of its own shows a library example on every surface, labelled as one; the seller's
// own photo always wins and carries no note. The library is swapped for a one-photo stand-in.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ItemWithVariants } from '@/lib/domain/types';

vi.mock('@/lib/library/catalog', () => ({
  LIBRARY: [
    {
      id: 'croissant-1', file: '/library/croissant-1.webp', type: 'croissant', category: 'pastry', tags: ['croissant'], shows: 'A croissant',
      source: 'https://www.pexels.com/photo/1/', photographer: 'Someone', licence: 'Pexels License',
    },
  ],
}));

const { MenuPanel } = await import('@/components/dashboard/MenuPanel');
const { IssueCard, PhotoContext } = await import('@/components/setup/IssueCards');
const { InPersonList, ReadyList } = await import('@/components/setup/ItemLists');
const { Menu, menuSections } = await import('@/components/shop/Menu');
const { ToastProvider } = await import('@/components/ui/toast');
const { itemPictures } = await import('@/lib/library/picture');

const item = (over: Partial<ItemWithVariants> = {}): ItemWithVariants => ({
  id: 'itm_croissant', shopId: 'shp_1', section: 'Pastry', name: 'Butter croissant', description: null, sourceText: 'Butter croissant',
  confidence: 'high', issues: [], issueDetail: null, kind: 'PHYSICAL', status: 'live', soldOut: false, photoUrl: null, category: null, examplePhoto: null,
  sort: 0, paypalProductId: null, publishedAt: null, updatedAt: '2026-11-06T00:00:00Z',
  variants: [{ id: 'var_1', itemId: 'itm_croissant', label: null, priceCents: 425, sort: 0 }],
  ...over,
});
const noop = () => {};
const OWN = '/i/img_abcdefghijklmnopqrst.webp';
const CAPTION = 'Example photo, replace with yours';

const shopPage = (it: ItemWithVariants) => renderToStaticMarkup(createElement(Menu, { sections: menuSections([it]), kind: 'food' }));
const menuTab = (it: ItemWithVariants) =>
  renderToStaticMarkup(
    createElement(ToastProvider, null, createElement(MenuPanel, { items: [it], shopId: 'shp_1', slug: 'm', shopKind: 'food', coverUrl: null, onItemsChange: noop, onCoverChange: noop })),
  );
const review = (it: ItemWithVariants) => {
  const d = { ...it, status: 'draft' as const };
  const pictures = itemPictures([d], 'food');
  return renderToStaticMarkup(createElement(ReadyList, { items: [d], onUpdate: noop, shopId: 'shp_1', shopKind: 'food', onPhoto: noop, pictures }));
};
const inPerson = (it: ItemWithVariants) => {
  const d = { ...it, status: 'in_person' as const };
  return renderToStaticMarkup(createElement(InPersonList, { items: [d], onUpdate: noop, shopId: 'shp_1', shopKind: 'food', onPhoto: noop, pictures: itemPictures([d], 'food') }));
};
const issueCard = (it: ItemWithVariants) => {
  const flagged = { ...it, status: 'draft' as const, issues: ['MISSING_PRICE' as const] };
  const card: ReactNode = createElement(IssueCard, { card: { kind: 'single', item: flagged }, id: 'c1', onUpdate: noop });
  return renderToStaticMarkup(createElement(PhotoContext, { value: { shopId: 'shp_1', shopKind: 'food', onPhoto: noop, pictures: itemPictures([flagged], 'food') } }, card));
};

describe('example photos', () => {
  it('the shop page shows the example with a hover/tap note, not an always-on badge', () => {
    const html = shopPage(item());
    expect(html).toContain('src="/library/croissant-1.webp"');
    expect(html).toContain('alt="Butter croissant, example photo"');
    expect(html).toContain('data-example-note');
    // The note starts hidden; hover, focus or a tap shows it.
    expect(html).toMatch(/opacity-0[^"]*group-hover\/tile:opacity-100/);
    expect(html).not.toContain(CAPTION);
  });

  it('the shop page shows the seller’s own photo with no note', () => {
    const html = shopPage(item({ photoUrl: OWN }));
    expect(html).toContain(`src="${OWN}"`);
    expect(html).not.toContain('croissant-1.webp');
    expect(html).not.toContain('data-example-note');
    expect(html).not.toMatch(/example photo/i);
  });

  it.each([
    ['Menu tab', menuTab],
    ['review ready row', review],
    ['review in-person row', inPerson],
    ['review issue card', issueCard],
  ] as const)('%s: the example shows with the seller’s line, which goes once they add their own', (_, render) => {
    const html = render(item());
    expect(html).toContain('/library/croissant-1.webp');
    expect(html).toContain(CAPTION);
    expect(html).toContain('aria-label="Add a photo of Butter croissant"');
    const own = render(item({ photoUrl: OWN }));
    expect(own).not.toContain('croissant-1.webp');
    expect(own).not.toContain(CAPTION);
  });
});
