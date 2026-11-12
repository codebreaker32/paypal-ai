// The seller's rows (setup review, the Menu tab; the review rows get the whole-menu `itemPictures` as ReviewStep passes it) draw an item with no photo exactly as the public menu does
// (`itemCategory(item, shop.kind)`), so a services shop's inner tube is a part everywhere, never a dish.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MenuPanel } from '@/components/dashboard/MenuPanel';
import { IssueCard, PhotoContext } from '@/components/setup/IssueCards';
import { InPersonList, ReadyList } from '@/components/setup/ItemLists';
import { Menu, menuSections } from '@/components/shop/Menu';
import { ToastProvider } from '@/components/ui/toast';
import type { ItemCategory } from '@/lib/domain/category';
import { itemPictures } from '@/lib/library/picture';
import type { ItemKind, ItemWithVariants, ShopKind } from '@/lib/domain/types';

const item = (name: string, over: Partial<ItemWithVariants> = {}): ItemWithVariants => ({
  id: `itm_${name.replace(/\W/g, '').toLowerCase()}`, shopId: 'shp_1', section: null, name, description: null, sourceText: name,
  confidence: 'high', issues: [], issueDetail: null, kind: 'PHYSICAL', status: 'live', soldOut: false, photoUrl: null, category: null, examplePhoto: null,
  sort: 0, paypalProductId: null, publishedAt: null, updatedAt: '2026-11-06T00:00:00Z',
  variants: [{ id: 'var_1', itemId: 'itm_1', label: null, priceCents: 900, sort: 0 }],
  ...over,
});

// What a row shows: its drawing's id, or the example photo's file when the library has a match.
const drawing = (html: string) =>
  html.match(/href="\/illustrations\.svg#([a-z_]+)"/)?.[1] ?? html.match(/src="(\/library\/[a-z0-9-]+\.webp)"/)?.[1];
const publicMenu = (it: ItemWithVariants, kind: ShopKind) => drawing(renderToStaticMarkup(createElement(Menu, { sections: menuSections([it]), kind })));
const noop = () => {};

const menuTab = (it: ItemWithVariants, shopKind: ShopKind) =>
  drawing(
    renderToStaticMarkup(
      createElement(ToastProvider, null, createElement(MenuPanel, { items: [it], shopId: 'shp_1', slug: 'spoke', shopKind, coverUrl: null, onItemsChange: noop, onCoverChange: noop })),
    ),
  );
const readyRow = (it: ItemWithVariants, shopKind: ShopKind) =>
  drawing(renderToStaticMarkup(createElement(ReadyList, { items: [{ ...it, status: 'draft' }], onUpdate: noop, shopId: 'shp_1', shopKind, onPhoto: noop, pictures: itemPictures([it], shopKind) })));
const inPersonRow = (it: ItemWithVariants, shopKind: ShopKind) =>
  drawing(renderToStaticMarkup(createElement(InPersonList, { items: [{ ...it, status: 'in_person' }], onUpdate: noop, shopId: 'shp_1', shopKind, onPhoto: noop, pictures: itemPictures([it], shopKind) })));
const issueCard = (it: ItemWithVariants, shopKind: ShopKind) => {
  const flagged = { ...it, status: 'draft' as const, issues: ['MISSING_PRICE' as const] };
  const card: ReactNode = createElement(IssueCard, { card: { kind: 'single', item: flagged }, id: 'c1', onUpdate: noop });
  return drawing(renderToStaticMarkup(createElement(PhotoContext, { value: { shopId: 'shp_1', shopKind, onPhoto: noop, pictures: itemPictures([flagged], shopKind) } }, card)));
};

const cases: [string, ShopKind, ItemKind, ItemCategory | string][] = [
  ['Pedals', 'services', 'PHYSICAL', 'bike_part'], // hand-added to a bike repair shop, no example photo
  ['Gift card', 'goods', 'PHYSICAL', 'goods'], // nothing matched in a goods shop: a bag, not a dish
  ['Catering service', 'food', 'SERVICE', 'meal'], // a food shop's service is still food on its menu
  ['Saddle fitting', 'services', 'SERVICE', 'tool'],
];

describe('row pictures match the public menu', () => {
  it.each(cases)('%j in a %s shop (%s) is drawn as %s', (name, shopKind, kind, expected) => {
    const it_ = item(name, { kind });
    expect(publicMenu(it_, shopKind)).toBe(expected);
    expect(menuTab(it_, shopKind)).toBe(expected);
    expect(readyRow(it_, shopKind)).toBe(expected);
    expect(inPersonRow(it_, shopKind)).toBe(expected);
    expect(issueCard(it_, shopKind)).toBe(expected);
  });
});

// An item the library has a photo for shows the same example photo on every surface.
const exampleCases: [string, ShopKind, ItemKind][] = [
  ['Inner tube', 'services', 'PHYSICAL'],
  ['Beeswax candle', 'goods', 'PHYSICAL'],
  ['Full tune-up', 'services', 'SERVICE'],
];

describe('example photos match the public menu', () => {
  it.each(exampleCases)('%j in a %s shop (%s) shows the same example photo everywhere', (name, shopKind, kind) => {
    const it_ = item(name, { kind });
    const shown = publicMenu(it_, shopKind);
    expect(shown).toMatch(/^\/library\//);
    expect(menuTab(it_, shopKind)).toBe(shown);
    expect(readyRow(it_, shopKind)).toBe(shown);
    expect(inPersonRow(it_, shopKind)).toBe(shown);
    expect(issueCard(it_, shopKind)).toBe(shown);
  });
});
