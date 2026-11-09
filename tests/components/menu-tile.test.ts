// The shop page's item tile (addendum section 2): structure, truncation, the tap target and the state table.
// `Menu` is rendered alone, so its client islands run on the cart's inert default.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AddControl } from '@/components/shop/AddControl';
import { CartContext, INERT_CART, type CartApi } from '@/components/shop/cart-context';
import { Menu, menuSections } from '@/components/shop/Menu';
import { orderableOptions, tilePrice } from '@/components/shop/tile';
import type { ItemWithVariants } from '@/lib/domain/types';
import { unavailableReason } from '@/lib/orders/pricing';

const variant = (id: string, label: string | null, priceCents: number | null) => ({ id, itemId: 'itm_1', label, priceCents, sort: 0 });
const item = (over: Partial<ItemWithVariants> = {}): ItemWithVariants => ({
  id: 'itm_1', shopId: 'shp_1', section: 'Pastry', name: 'Butter croissant', description: 'Flaky. Contains nuts.', sourceText: 'x',
  confidence: 'high', issues: [], issueDetail: null, kind: 'PHYSICAL', status: 'live', soldOut: false, photoUrl: '/i/a.webp', category: null, examplePhoto: null,
  sort: 0, paypalProductId: null, publishedAt: null, updatedAt: '2026-11-06T00:00:00Z',
  variants: [variant('var_1', null, 425)],
  ...over,
});

const tile = (it: ItemWithVariants, takesOrders?: boolean) =>
  renderToStaticMarkup(createElement(Menu, { sections: menuSections([it]), kind: 'food', takesOrders }));
const THREE = [variant('v1', 'S', 400), variant('v2', 'M', 300), variant('v3', 'L', 500)];
const ADD = 'data-add-control';

describe('tilePrice', () => {
  it('shows one or two options in full', () => {
    expect(tilePrice(item())).toEqual({ kind: 'options', options: [{ id: 'var_1', label: null, cents: 425 }] });
    const two = tilePrice(item({ variants: [variant('v1', 'S', 300), variant('v2', 'L', 400)] }));
    expect(two).toEqual({ kind: 'options', options: [{ id: 'v1', label: 'S', cents: 300 }, { id: 'v2', label: 'L', cents: 400 }] });
  });

  it('three or more options become the lowest price and the count', () => {
    expect(tilePrice(item({ variants: THREE }))).toEqual({ kind: 'from', cents: 300, count: 3 });
  });

  it('ignores unpriced options, and has nothing to show without a price', () => {
    expect(tilePrice(item({ variants: [variant('v1', 'S', null), variant('v2', 'L', 400)] }))).toEqual({
      kind: 'options',
      options: [{ id: 'v2', label: 'L', cents: 400 }],
    });
    expect(tilePrice(item({ variants: [variant('v1', null, null)] }))).toBeNull();
    expect(tilePrice(item({ status: 'in_person' }))).toBeNull();
  });
});

describe('orderableOptions', () => {
  it.each([
    ['live', item()],
    ['two options', item({ variants: THREE })],
    ['sold out', item({ soldOut: true })],
    ['in person', item({ status: 'in_person' })],
    ['no price', item({ variants: [variant('v1', null, null)] })],
  ])('agrees with what the agent door would refuse: %s', (_, it_) => {
    expect(orderableOptions(it_, true).length > 0).toBe(unavailableReason(it_) === null);
  });

  it('offers nothing while the shop is not taking orders', () => {
    expect(orderableOptions(item(), false)).toEqual([]);
  });
});

describe('the tile', () => {
  it('is photo, then name in a button that opens the sheet, then price, then description', () => {
    const html = tile(item());
    expect(html.indexOf('tile-photo')).toBeLessThan(html.indexOf('<h4'));
    expect(html).toMatch(/<h4[^>]*><button[^>]*aria-haspopup="dialog"/);
    expect(html).toMatch(/after:absolute[^"]*after:inset-0/);
    expect(html.indexOf('<h4')).toBeLessThan(html.indexOf('$4.25'));
    expect(html.indexOf('$4.25')).toBeLessThan(html.indexOf('Flaky'));
  });

  it('clamps the name on an inner span, never on the button, and the description to 2 lines', () => {
    const html = tile(item());
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*><span class="[^"]*line-clamp-2/);
    expect(html).not.toMatch(/<button[^>]*line-clamp/);
    expect(html).toMatch(/<p class="[^"]*line-clamp-2[^"]*">Flaky/);
  });

  it('keeps the note server-safe: a non-interactive span', () => {
    const html = tile(item({ photoUrl: null, examplePhoto: null }));
    expect(html).toMatch(/<span[^>]*data-example-note/);
    expect(html).not.toMatch(/<button[^>]*data-example-note/);
  });

  it('orderable with one option: a + that adds', () => {
    const html = tile(item());
    expect(html).toContain(ADD);
    expect(html).toContain('aria-label="Add Butter croissant to your order"');
  });

  it('orderable with options: the + opens the sheet', () => {
    const html = tile(item({ variants: THREE }));
    expect(html).toContain(ADD);
    expect(html).toContain('aria-label="Choose options for Butter croissant"');
    expect(html).toContain('From');
    expect(html).toContain('$3.00');
    expect(html).toContain('3 options');
  });

  it('sold out: dimmed, muted text, the pill, no control, still opens the sheet', () => {
    const html = tile(item({ soldOut: true }));
    expect(html).toContain('Sold out today');
    expect(html).toContain('grayscale');
    expect(html).not.toContain(ADD);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('ask in person replaces the price, no control, still opens the sheet', () => {
    const html = tile(item({ status: 'in_person' }));
    expect(html).toContain('Ask in person');
    expect(html).not.toContain('$4.25');
    expect(html).not.toContain(ADD);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('shop not taking orders: prices shown, no control, still opens the sheet', () => {
    const html = tile(item(), false);
    expect(html).toContain('$4.25');
    expect(html).not.toContain(ADD);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('takes orders by default', () => {
    expect(tile(item())).toContain(ADD);
  });
});

describe('AddControl', () => {
  const render = (cart: Partial<CartApi>) =>
    renderToStaticMarkup(
      createElement(CartContext.Provider, { value: { ...INERT_CART, ...cart } }, createElement(AddControl, { itemId: 'itm_1', itemName: 'Butter croissant', optionId: 'var_1' })),
    );

  it('renders a lone + with no provider', () => {
    const html = renderToStaticMarkup(createElement(AddControl, { itemId: 'itm_1', itemName: 'Butter croissant', optionId: 'var_1' }));
    expect(html).toContain('aria-label="Add Butter croissant to your order"');
    expect(html).not.toContain('Remove one');
  });

  it('in the order: minus, the count and the same + still mounted', () => {
    const html = render({ quantity: vi.fn(() => 2) });
    expect(html).toContain('aria-label="Remove one Butter croissant"');
    expect(html).toContain('2 in your order');
    expect(html).toContain('aria-label="Add Butter croissant to your order"');
  });
});
