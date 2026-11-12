// "Your orders" on this device: the localStorage list behind /orders.
import { describe, expect, it } from 'vitest';
import { MY_ORDERS_KEY, MY_ORDERS_MAX, MY_ORDERS_MAX_AGE_MS, forget, listMyOrders, remember, type MyOrder } from '@/lib/client/my-orders';

class MemStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const NOW = Date.parse('2026-11-12T12:00:00Z');
const order = (n: number, over: Partial<MyOrder> = {}): MyOrder => ({
  ref: `ord_${n}`,
  shopName: 'Rosa Bakes',
  shopSlug: 'rosa-bakes',
  total: 950,
  createdAt: new Date(NOW - n * 60_000).toISOString(),
  ...over,
});

describe('my orders store', () => {
  it('dedupes by ref and keeps newest first', () => {
    const s = new MemStore();
    remember(order(2), s, NOW);
    remember(order(1), s, NOW);
    remember(order(2), s, NOW);
    expect(listMyOrders(s, NOW).map((o) => o.ref)).toEqual(['ord_1', 'ord_2']);
  });

  it('keeps at most 50', () => {
    const s = new MemStore();
    for (let i = 1; i <= MY_ORDERS_MAX + 5; i++) remember(order(i), s, NOW);
    const list = listMyOrders(s, NOW);
    expect(list).toHaveLength(MY_ORDERS_MAX);
    expect(list[0].ref).toBe('ord_1');
    expect(list.at(-1)!.ref).toBe(`ord_${MY_ORDERS_MAX}`);
  });

  it('drops entries older than 180 days', () => {
    const s = new MemStore();
    remember(order(1), s, NOW);
    remember(order(9, { createdAt: new Date(NOW - MY_ORDERS_MAX_AGE_MS - 1000).toISOString() }), s, NOW);
    expect(listMyOrders(s, NOW).map((o) => o.ref)).toEqual(['ord_1']);
  });

  it('reads broken JSON or bad entries as an empty list, and recovers on the next remember', () => {
    const s = new MemStore();
    s.setItem(MY_ORDERS_KEY, '{not json');
    expect(listMyOrders(s, NOW)).toEqual([]);
    s.setItem(MY_ORDERS_KEY, JSON.stringify({ ref: 'ord_1' }));
    expect(listMyOrders(s, NOW)).toEqual([]);
    s.setItem(MY_ORDERS_KEY, JSON.stringify([order(1), { ref: 'nope' }, null, 5]));
    expect(listMyOrders(s, NOW).map((o) => o.ref)).toEqual(['ord_1']);
    s.setItem(MY_ORDERS_KEY, 'garbage');
    expect(remember(order(3), s, NOW).map((o) => o.ref)).toEqual(['ord_3']);
  });

  it('survives storage that throws, and forget removes one entry', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(listMyOrders(throwing, NOW)).toEqual([]);
    expect(() => remember(order(1), throwing, NOW)).not.toThrow();
    expect(listMyOrders(null, NOW)).toEqual([]);

    const s = new MemStore();
    remember(order(1), s, NOW);
    remember(order(2), s, NOW);
    expect(forget('ord_1', s, NOW).map((o) => o.ref)).toEqual(['ord_2']);
    expect(listMyOrders(s, NOW).map((o) => o.ref)).toEqual(['ord_2']);
  });
});
