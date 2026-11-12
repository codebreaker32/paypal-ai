import { describe, expect, it } from 'vitest';
import {
  CART_TTL_MS,
  MAX_QTY_PER_LINE,
  addLine,
  addRefusal,
  cartAnnouncement,
  cartKey,
  cartNotice,
  cartTotals,
  checkoutBody,
  clearCartIfPaid,
  decrementItem,
  itemQuantity,
  joinCart,
  loadCart,
  newRequestId,
  parseCart,
  pendingKey,
  refusalAction,
  requestIdFor,
  saveCart,
  savePendingOrder,
  serializeCart,
  setLineQty,
  type CartLine,
  type CartMenuItem,
} from '@/components/shop/cart';

const item = (id: string, over: Partial<CartMenuItem> = {}): CartMenuItem => ({
  id,
  name: `Item ${id}`,
  description: '',
  state: 'orderable',
  options: [{ id: `${id}-o`, label: null, cents: 300 }],
  priceText: '$3.00',
  picture: { photoUrl: null, category: 'pastry' },
  tone: 0,
  example: false,
  ...over,
});
const L = (itemId: string, qty = 1, optionId = `${itemId}-o`): CartLine => ({ itemId, optionId, qty });

function storage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('lines', () => {
  it('adds, merging the same option and capping a line at 20', () => {
    let lines = addLine([], 'a', 'a-o');
    lines = addLine(lines, 'a', 'a-o', 2);
    expect(lines).toEqual([L('a', 3)]);
    expect(addLine(lines, 'a', 'a-o', 40)).toEqual([L('a', 20)]);
    expect(addLine(lines, 'b', 'b-o')).toEqual([L('a', 3), L('b', 1)]);
  });

  it('comes back unchanged when the line is already at 20, so the press can be refused', () => {
    const full = [L('a', MAX_QTY_PER_LINE)];
    expect(addLine(full, 'a', 'a-o')).toBe(full);
    expect(addRefusal(full, 'a', 'a-o')).toBe('An order can hold 20 of each item.');
  });

  it('names the line limit when a new line has no room', () => {
    const full = Array.from({ length: 15 }, (_, i) => L(`i${i}`));
    expect(addRefusal(full, 'x', 'x-o')).toBe('An order can hold 15 different items.');
  });

  it('refuses a sixteenth line', () => {
    const full = Array.from({ length: 15 }, (_, i) => L(`i${i}`));
    expect(addLine(full, 'x', 'x-o')).toBe(full);
    expect(addLine(full, 'i3', 'i3-o')[3].qty).toBe(2);
  });

  it('decrements the most recent line of an item, dropping it at zero', () => {
    const lines = [L('a', 1, 's'), L('b'), L('a', 2, 'l')];
    expect(decrementItem(lines, 'a')).toEqual([L('a', 1, 's'), L('b'), L('a', 1, 'l')]);
    expect(decrementItem([L('a', 1, 's')], 'a')).toEqual([]);
    expect(decrementItem(lines, 'z')).toBe(lines);
  });

  it('sets a quantity: 0 removes, over 20 caps', () => {
    expect(setLineQty([L('a', 2)], 'a', 'a-o', 0)).toEqual([]);
    expect(setLineQty([L('a', 2)], 'a', 'a-o', 99)).toEqual([L('a', 20)]);
    expect(setLineQty([L('a', 2)], 'a', 'a-o', 5)).toEqual([L('a', 5)]);
  });

  it('counts an item across its options', () => {
    expect(itemQuantity([L('a', 1, 's'), L('b', 4), L('a', 2, 'l')], 'a')).toBe(3);
  });
});

describe('joinCart', () => {
  it('prices lines from the menu and drops what can no longer be ordered', () => {
    const menu = [item('a', { options: [{ id: 'a-o', label: 'Large', cents: 450 }] }), item('sold', { name: 'Seeded rye', state: 'sold_out', options: [] }), item('asked', { state: 'in_person', options: [] })];
    const { views, lines, removed } = joinCart([L('a', 2), L('sold'), L('asked'), L('gone')], menu);
    expect(lines).toEqual([L('a', 2)]);
    expect(views).toEqual([expect.objectContaining({ itemId: 'a', optionLabel: 'Large', unitCents: 450, lineCents: 900, qty: 2 })]);
    expect(removed.map((r) => r.reason)).toEqual(['sold_out', 'unavailable', 'unavailable']);
    expect(removed[0].name).toBe('Seeded rye');
    expect(removed[2].name).toBeNull();
  });

  it('keeps every line while the shop is only not taking orders, and says nothing (a pause must not lose the cart)', () => {
    const menu = [item('p', { state: 'not_taking', options: [], heldOptions: [{ id: 'p-o', label: 'Large', cents: 450 }] })];
    const { lines, views, removed, paused } = joinCart([L('p', 2)], menu);
    expect(lines).toEqual([L('p', 2)]);
    expect(views).toEqual([expect.objectContaining({ itemId: 'p', optionLabel: 'Large', lineCents: 900 })]);
    expect(removed).toEqual([]);
    expect(paused).toBe(true);
  });

  it('is not paused when everything can be ordered, and a paused shop still loses what is really gone', () => {
    expect(joinCart([L('a')], [item('a')]).paused).toBe(false);
    const menu = [item('p', { state: 'not_taking', options: [], heldOptions: [{ id: 'p-o', label: null, cents: 300 }] }), item('sold', { state: 'sold_out', options: [] })];
    const { lines, removed } = joinCart([L('p'), L('sold'), L('p', 1, 'old-option')], menu);
    expect(lines).toEqual([L('p')]);
    expect(removed.map((r) => r.reason)).toEqual(['sold_out', 'unavailable']);
  });

  it('drops a line whose option is gone', () => {
    expect(joinCart([L('a', 1, 'old')], [item('a')]).lines).toEqual([]);
  });

  it('says what it took out in one line', () => {
    expect(cartNotice([])).toBeNull();
    expect(cartNotice([{ name: 'Seeded rye', reason: 'sold_out' }])).toBe('Seeded rye is sold out today, so we took it out.');
    expect(cartNotice([{ name: 'Rye', reason: 'unavailable' }])).toBe('Rye is no longer available, so we took it out.');
    expect(cartNotice([{ name: null, reason: 'unavailable' }])).toBe('Something in your order is no longer available, so we took it out.');
    expect(cartNotice([{ name: 'A', reason: 'sold_out' }, { name: null, reason: 'unavailable' }])).toBe('2 items in your order are no longer available, so we took them out.');
  });

  it('totals display-only figures', () => {
    const { views } = joinCart([L('a', 2)], [item('a')]);
    expect(cartTotals(views, 800)).toEqual({ count: 2, itemsCents: 600, shippingCents: 800, totalCents: 1400 });
  });
});

describe('storage', () => {
  const now = 1_000_000_000;
  it('keeps only itemId, optionId and qty', () => {
    const raw = JSON.parse(serializeCart([{ ...L('a'), priceCents: 1 } as CartLine], now));
    expect(raw.lines).toEqual([L('a')]);
  });
  it('restores within 24 hours, not after', () => {
    const s = serializeCart([L('a', 2)], now);
    expect(parseCart(s, now + CART_TTL_MS - 1)).toEqual([L('a', 2)]);
    expect(parseCart(s, now + CART_TTL_MS + 1)).toEqual([]);
  });
  it('survives garbage', () => {
    expect(parseCart('{', now)).toEqual([]);
    expect(parseCart(null, now)).toEqual([]);
    expect(parseCart(JSON.stringify({ savedAt: now, lines: [{ itemId: 1 }, { itemId: 'a', optionId: 'o', qty: 99 }, { itemId: 'b', optionId: 'o', qty: 0 }] }), now)).toEqual([{ itemId: 'a', optionId: 'o', qty: 20 }]);
  });
  it('saves under the shop key and removes an empty cart', () => {
    const s = storage();
    saveCart('marigold', [L('a')], s, now);
    expect(s.map.has(cartKey('marigold'))).toBe(true);
    expect(loadCart('marigold', s, now)).toEqual([L('a')]);
    saveCart('marigold', [], s, now);
    expect(s.map.has(cartKey('marigold'))).toBe(false);
  });
  it('does not renew the 24 hours when the lines have not changed', () => {
    const s = storage();
    saveCart('marigold', [L('a', 2)], s, now);
    saveCart('marigold', [L('a', 2)], s, now + 23 * 60 * 60 * 1000);
    expect(JSON.parse(s.map.get(cartKey('marigold'))!).savedAt).toBe(now);
  });
  it('restarts the clock when the lines change', () => {
    const s = storage();
    saveCart('marigold', [L('a', 2)], s, now);
    saveCart('marigold', [L('a', 3)], s, now + 1000);
    expect(JSON.parse(s.map.get(cartKey('marigold'))!).savedAt).toBe(now + 1000);
  });
  it('never throws when storage does', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadCart('s', bad, now)).toEqual([]);
    expect(() => saveCart('s', [L('a')], bad, now)).not.toThrow();
    expect(() => savePendingOrder('s', 'ref', bad)).not.toThrow();
    expect(() => clearCartIfPaid('s', 'ref', 'paid', bad)).not.toThrow();
  });
});

describe('after PayPal', () => {
  const seeded = () => storage({ [cartKey('s')]: serializeCart([L('a')], 5), [pendingKey('s')]: 'ref1' });
  it.each(['paid', 'payment_pending', 'fulfilled'] as const)('clears on %s when the ref matches', (status) => {
    const s = seeded();
    clearCartIfPaid('s', 'ref1', status, s);
    expect(s.map.size).toBe(0);
  });
  it.each(['cancelled', 'expired', 'failed', 'awaiting_approval', 'approved'] as const)('keeps the cart on %s', (status) => {
    const s = seeded();
    clearCartIfPaid('s', 'ref1', status, s);
    expect(s.map.has(cartKey('s'))).toBe(true);
  });
  it('keeps the cart for another order', () => {
    const s = seeded();
    clearCartIfPaid('s', 'other', 'paid', s);
    expect(s.map.has(cartKey('s'))).toBe(true);
  });
});

describe('checkout request', () => {
  it('sends no price but the expected total', () => {
    const body = checkoutBody({ lines: [L('a', 2)], fulfillment: 'pickup', note: '  no nuts  ', expectedTotalCents: 600, requestId: 'r-12345678' });
    expect(body).toEqual({ lines: [{ itemId: 'a', optionId: 'a-o', quantity: 2 }], fulfillment: 'pickup', note: 'no nuts', expectedTotalCents: 600, requestId: 'r-12345678' });
  });
  it('leaves out an empty note', () => {
    expect(checkoutBody({ lines: [L('a')], fulfillment: 'shipping', note: '  ', expectedTotalCents: 1, requestId: 'r-12345678' })).not.toHaveProperty('note');
  });
  it('keeps the request id only while lines, fulfilment and note stay the same', () => {
    let n = 0;
    const make = () => `id-${++n}`;
    const base = { lines: [L('a')], fulfillment: 'pickup' as const, note: '' };
    const first = requestIdFor(null, base, make);
    expect(requestIdFor(first, base, make)).toBe(first);
    const noted = requestIdFor(first, { ...base, note: 'x' }, make);
    expect(noted.id).not.toBe(first.id);
    const moreLines = requestIdFor(noted, { ...base, note: 'x', lines: [L('a', 2)] }, make);
    expect(moreLines.id).not.toBe(noted.id);
    const shipped = requestIdFor(moreLines, { ...base, note: 'x', lines: [L('a', 2)], fulfillment: 'shipping' }, make);
    expect(shipped.id).not.toBe(moreLines.id);
  });
  it('makes an id the route accepts', () => {
    const id = newRequestId();
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(newRequestId()).not.toBe(id);
  });
  it('maps refusals to what the client does', () => {
    expect(refusalAction('CHECKOUT_STALE')).toBe('retry');
    expect(refusalAction('IDEMPOTENCY_CONFLICT')).toBe('retry');
    expect(refusalAction('PRICE_CHANGED')).toBe('refresh');
    expect(refusalAction('OPTION_REQUIRED')).toBe('refresh');
    expect(refusalAction('ITEM_UNAVAILABLE')).toBe('remove');
    expect(refusalAction('UNKNOWN_ITEM')).toBe('remove');
    expect(refusalAction('PAYPAL_UNAVAILABLE')).toBe('show');
    expect(refusalAction('SHOP_NOT_ACCEPTING_ORDERS')).toBe('show');
  });
});

describe('announcement', () => {
  it('says what changed and where the order stands', () => {
    expect(cartAnnouncement('Almond croissant', 'added', 3, 1900)).toBe('Almond croissant added. 3 items, $19.00.');
    expect(cartAnnouncement('Rye', 'removed', 1, 300)).toBe('Rye removed. 1 item, $3.00.');
    expect(cartAnnouncement('Rye', 'removed', 0, 0)).toBe('Rye removed. Your order is empty.');
  });
});

describe('the rules the client shares with the server', () => {
  it('keeps the same limits as pricing', async () => {
    const { ORDER_LIMITS } = await import('@/lib/orders/pricing');
    const { MAX_LINES, MAX_QTY_PER_LINE } = await import('@/components/shop/cart');
    expect({ maxQtyPerLine: MAX_QTY_PER_LINE, maxLines: MAX_LINES }).toEqual(ORDER_LIMITS);
  });
});
