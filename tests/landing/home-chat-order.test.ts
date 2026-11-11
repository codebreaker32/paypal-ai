import { describe, expect, it } from 'vitest';
import { itemCards, latestOrder, MAX_CARDS, quickReplies, readBackFulfillment } from '@/components/landing/chat/order';
import { PAYMENT_CHECK_PROMPT } from '@/components/shop/BuyerConsole';
import { consoleReducer, initialConsoleState, type ConsoleState } from '@/components/shop/console-state';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';

const run = (events: ConsoleEvent[], from: ConsoleState = initialConsoleState) =>
  events.reduce((s, event) => consoleReducer(s, { type: 'event', event }), from);

const menu = [
  { id: 'i1', name: 'Almond croissant', priceCents: 500, photoUrl: '/demo/a.jpg', example: false },
  { id: 'i2', name: 'Country sourdough loaf', priceCents: 900, photoUrl: '/library/bread.webp', example: true },
  { id: 'i3', name: 'Butter croissant', priceCents: 400, photoUrl: null, example: false },
];

const item = (item_id: string, name: string, price: string | null, orderable = true) => ({
  item_id, name, description: null, orderable, options: [{ option_id: `${item_id}-o`, label: null, price }],
});

/** A turn: the buyer asks, the assistant lists products (the given items), then replies with `reply`. */
function turn(items: ReturnType<typeof item>[], reply: string, from: ConsoleState = initialConsoleState) {
  const s = consoleReducer(from, { type: 'send', text: 'Something without nuts?' });
  return run([
    { type: 'tool_call', id: `l${s.nextKey}`, name: 'list_products', input: { query: 'croissant' } },
    { type: 'tool_result', id: `l${s.nextKey}`, ok: true, ms: 3, result: { sections: [{ name: 'Pastries', items }], data_notice: '' } },
    { type: 'text', text: reply },
    { type: 'done' },
  ], s);
}

describe('home chat helpers', () => {
  it('cards are the looked-up items a reply names, in its order, with the tool’s price and the menu’s picture', () => {
    const s = turn(
      [item('i1', 'Almond croissant', '5.00'), item('i2', 'Country sourdough loaf', '9.50'), item('i3', 'Butter croissant', '4.25')],
      'The almond ones have nuts. Try 2 **Butter croissants** or the Country sourdough loaf.',
    );
    const at = s.entries.findIndex((e) => e.kind === 'assistant');
    expect(itemCards(s.entries, at, menu)).toEqual([
      { id: 'i3', name: 'Butter croissant', priceCents: 425, photoUrl: null, example: false },
      { id: 'i2', name: 'Country sourdough loaf', priceCents: 950, photoUrl: '/library/bread.webp', example: true },
    ]);
  });

  it('never shows an item the tools did not return, one without a price, or one that cannot be ordered', () => {
    const s = turn([item('i1', 'Almond croissant', null), item('i3', 'Butter croissant', '4.25', false)], 'Almond croissant, Butter croissant or a Country sourdough loaf?');
    const at = s.entries.findIndex((e) => e.kind === 'assistant');
    expect(itemCards(s.entries, at, menu)).toEqual([]);
  });

  it('reads only its own turn and shows at most four', () => {
    const names = ['Alpha bun', 'Beta bun', 'Gamma bun', 'Delta bun', 'Epsilon bun'];
    const first = turn(names.map((n, i) => item(`x${i}`, n, '3.00')), names.join(', '));
    expect(itemCards(first.entries, first.entries.findIndex((e) => e.kind === 'assistant'), [])).toHaveLength(MAX_CARDS);
    const second = run([{ type: 'text', text: 'Alpha bun it is.' }, { type: 'done' }], consoleReducer(first, { type: 'send', text: 'Alpha please' }));
    expect(itemCards(second.entries, second.entries.length - 1, [])).toEqual([]);
  });

  it('reads the latest placed order with its approval once the turn ends', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'Yes, place it' });
    s = run([
      { type: 'tool_call', id: 't', name: 'create_order', input: {} },
      {
        type: 'tool_result', id: 't', ok: true, ms: 5,
        result: { order_ref: 'ord_1', order_number: 'SHF-1', fulfillment: 'shipping', lines: [{ name: 'Almond croissant', option: null, quantity: 2, line_total: '10.00' }], items_total: '10.00', shipping: '8.00', total: '18.00' },
      },
      { type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=X', total: '18.00', orderRef: 'ord_1', orderNumber: 'SHF-1' },
    ], s);
    expect(latestOrder(s)?.approval).toBeNull();
    s = run([{ type: 'done' }], s);
    const order = latestOrder(s)!;
    expect(order).toMatchObject({ orderRef: 'ord_1', orderNumber: 'SHF-1', total: '18.00', shipping: '8.00' });
    expect(order.lines).toEqual([{ name: 'Almond croissant', option: null, quantity: 2, lineTotal: '10.00' }]);
    expect(order.approval?.approvalUrl).toContain('sandbox.paypal.com');
    expect(order.view?.approve).toBe(true);
    expect(quickReplies(s)).toEqual([PAYMENT_CHECK_PROMPT]);
  });

  it('offers to confirm a read-back order, and nothing while busy', () => {
    const asked = run([{ type: 'text', text: 'Total $27.00. Should I place it?' }, { type: 'done' }], consoleReducer(initialConsoleState, { type: 'send', text: 'hi' }));
    expect(quickReplies(asked)).toContain('Yes, place it');
    expect(quickReplies(consoleReducer(asked, { type: 'send', text: 'yes' }))).toEqual([]);
    expect(latestOrder(asked)).toBeNull();
  });

  describe('quick replies follow the read-back', () => {
    const readBack = (text: string) => run([{ type: 'text', text }, { type: 'done' }], consoleReducer(initialConsoleState, { type: 'send', text: 'hi' }));

    it('a pickup read-back offers shipping instead', () => {
      const s = readBack('2 Almond croissants, $10.00. Pickup is Sat or Sun 9 to 1, so no shipping fee. Total $10.00. Should I place it?');
      expect(quickReplies(s)).toEqual(['Yes, place it', 'Ship it to me instead']);
    });

    it('a shipping read-back offers pickup instead', () => {
      const s = readBack('1 Country sourdough loaf, $9.00, shipped to Ana in Austin with $8.00 shipping. Total $17.00. Shall I place it?');
      expect(quickReplies(s)).toEqual(['Yes, place it', 'Make it pickup instead']);
    });

    it('a read-back that names neither, or both, offers only to place it', () => {
      expect(quickReplies(readBack('2 Butter croissants, total $8.00. Should I place it?'))).toEqual(['Yes, place it']);
      expect(quickReplies(readBack('Pickup is free, or shipping is $8.00. Which one, and should I place it?'))).toEqual(['Yes, place it']);
    });

    it('reads the way out of the wording', () => {
      expect(readBackFulfillment('Pick-up Saturday, no delivery fee.')).toBe('pickup');
      expect(readBackFulfillment('Free shipping, collect it at the market.')).toBe('pickup');
      expect(readBackFulfillment('Delivered to 12 Elm St.')).toBe('shipping');
      expect(readBackFulfillment('Total $8.00.')).toBeNull();
    });
  });
});
