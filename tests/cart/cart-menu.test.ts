import { describe, expect, it } from 'vitest';
import { shopCartData } from '@/components/shop/cart-menu';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';

const variant = (id: string, priceCents: number | null, label: string | null = null) => ({ id, itemId: 'x', label, priceCents, sort: 0 }) as unknown as ItemWithVariants['variants'][number];
const item = (id: string, over: Partial<ItemWithVariants> = {}): ItemWithVariants =>
  ({ id, name: `Item ${id}`, description: 'Desc', status: 'live', soldOut: false, photoUrl: null, variants: [variant(`${id}-a`, 300)], ...over }) as unknown as ItemWithVariants;
const shop = { fulfillment: 'both', shippingFeeCents: 800, pickupNotes: 'At the counter', orderCapCents: 50000 } as Shop;
const data = (items: ItemWithVariants[], takes = true) => shopCartData(shop, [{ name: 'Menu', items }], 'food', takes);

describe('shopCartData', () => {
  it('passes the shop rules through', () => {
    expect(data([item('a')])).toMatchObject({ fulfillment: 'both', shippingCents: 800, pickupNotes: 'At the counter', orderCapCents: 50000 });
  });
  it('marks each state', () => {
    const { items } = data([item('a'), item('b', { soldOut: true }), item('c', { status: 'in_person' }), item('d', { variants: [variant('d-a', null)] })]);
    expect(items.map((i) => i.state)).toEqual(['orderable', 'sold_out', 'in_person', 'in_person']);
    expect(items[0].options).toEqual([{ id: 'a-a', label: null, cents: 300 }]);
    expect(items[1].options).toEqual([]);
  });
  it('has no options for anything in a shop not taking orders', () => {
    const { items } = data([item('a'), item('b', { soldOut: true })], false);
    expect(items.map((i) => i.state)).toEqual(['not_taking', 'sold_out']);
    expect(items[0].options).toEqual([]);
    expect(items[0].priceText).toBe('$3.00');
  });
  it('keeps the prices of a paused item aside, so a saved cart can still be shown', () => {
    const { items } = data([item('a'), item('b', { soldOut: true })], false);
    expect(items[0].heldOptions).toEqual([{ id: 'a-a', label: null, cents: 300 }]);
    expect(items[1].heldOptions).toEqual([]);
  });
  it('writes the price line', () => {
    const { items } = data([
      item('a', { variants: [variant('s', 300, 'S'), variant('l', 400, 'L')] }),
      item('b', { variants: [variant('1', 300), variant('2', 400), variant('3', 500)] }),
      item('c', { status: 'in_person' }),
    ]);
    expect(items.map((i) => i.priceText)).toEqual(['S $3.00   L $4.00', 'From $3.00 · 3 options', null]);
  });
});
