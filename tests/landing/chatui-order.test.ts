import { describe, expect, it } from 'vitest';
import { itemsMentioned, latestOrder, quickReplies } from '@/components/landing/chatui/order';
import { parseChatUi } from '@/components/landing/chatui/types';
import { PAYMENT_CHECK_PROMPT } from '@/components/shop/BuyerConsole';
import { consoleReducer, initialConsoleState, type ConsoleState } from '@/components/shop/console-state';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';

const run = (events: ConsoleEvent[], from: ConsoleState = initialConsoleState) =>
  events.reduce((s, event) => consoleReducer(s, { type: 'event', event }), from);

const menu = [
  { id: 'i1', name: 'Almond croissant', section: 'Pastries', description: 'contains nuts!', priceCents: 500, photoUrl: '/demo/a.jpg' },
  { id: 'i2', name: 'Country sourdough loaf', section: 'Breads', description: null, priceCents: 900, photoUrl: null },
  { id: 'i3', name: 'Butter croissant', section: 'Pastries', description: null, priceCents: 400, photoUrl: null },
];

describe('chatui order helpers', () => {
  it('parses only a, b and c', () => {
    expect(parseChatUi('b')).toBe('b');
    expect(parseChatUi('d')).toBeNull();
    expect(parseChatUi(['a'])).toBeNull();
    expect(parseChatUi(undefined)).toBeNull();
  });

  it('finds whole item names in the order a reply names them', () => {
    expect(itemsMentioned('1 × Country sourdough loaf and 2 × **Almond croissant**', menu).map((i) => i.id)).toEqual(['i2', 'i1']);
    expect(itemsMentioned('A croissant?', menu)).toEqual([]);
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
});
