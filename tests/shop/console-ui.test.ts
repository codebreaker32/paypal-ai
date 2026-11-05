// Pure pieces of the buyer console UI: the event reducer, starter prompts and Activity summaries.
import { describe, expect, it } from 'vitest';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';
import type { ItemWithVariants } from '@/lib/domain/types';
import { argSummary, isPayPalApprovalUrl, requestJson, resultSummary } from '@/components/shop/activity-format';
import { consoleReducer, initialConsoleState, restoreConsoleState, type ConsoleState } from '@/components/shop/console-state';
import { starterPrompts } from '@/components/shop/starters';

const run = (state: ConsoleState, ...events: ConsoleEvent[]) => events.reduce((s, event) => consoleReducer(s, { type: 'event', event }), state);

describe('consoleReducer', () => {
  it('turns a streamed turn into user, activity, approval and assistant entries', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'Two almond croissants' });
    expect(s.busy).toBe(true);
    s = run(
      s,
      { type: 'session', id: 'asst_1' },
      { type: 'tool_call', id: 't1', name: 'get_shop_info', input: {} },
      { type: 'tool_call', id: 't2', name: 'list_products', input: {} },
      { type: 'tool_result', id: 't2', ok: true, result: { sections: [] }, ms: 90 },
      { type: 'tool_result', id: 't1', ok: true, result: { shop_name: 'Marigold' }, ms: 120 },
      { type: 'text', text: 'Here is your order.' },
      { type: 'tool_call', id: 't3', name: 'create_order', input: { items: [] } },
      { type: 'tool_result', id: 't3', ok: false, result: { error: { code: 'OPTION_REQUIRED' } }, ms: 30 },
      { type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=1', total: '27.00', orderRef: 'ord_1', orderNumber: 'SHF-AAAAAA' },
      { type: 'done' },
    );
    expect(s.sessionId).toBe('asst_1');
    expect(s.busy).toBe(false);
    expect(s.entries.map((e) => e.kind)).toEqual(['user', 'activity', 'assistant', 'activity', 'approval']);
    const first = s.entries[1] as Extract<ConsoleState['entries'][number], { kind: 'activity' }>;
    expect(first.calls.map((c) => [c.name, c.status, c.ms])).toEqual([
      ['get_shop_info', 'ok', 120],
      ['list_products', 'ok', 90],
    ]);
    const second = s.entries[3] as Extract<ConsoleState['entries'][number], { kind: 'activity' }>;
    expect(second.calls[0]).toMatchObject({ name: 'create_order', status: 'error', result: { error: { code: 'OPTION_REQUIRED' } } });
    expect(new Set(s.entries.map((e) => e.key)).size).toBe(s.entries.length);
  });

  it('shows error events and failures as error entries and stops being busy', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'hi' });
    s = run(s, { type: 'error', message: "The shop didn't answer. Try again." });
    expect(s.busy).toBe(false);
    expect(s.entries.at(-1)).toMatchObject({ kind: 'error', message: "The shop didn't answer. Try again." });
    s = consoleReducer(consoleReducer(s, { type: 'send', text: 'again' }), { type: 'fail', message: 'Too many messages.' });
    expect(s.busy).toBe(false);
    expect(s.entries.at(-1)).toMatchObject({ kind: 'error', message: 'Too many messages.' });
  });

  it('restores a saved conversation, never as busy, with unfinished calls marked as interrupted', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'hi' });
    s = run(s, { type: 'session', id: 'asst_9' }, { type: 'tool_call', id: 't1', name: 'list_products', input: {} });
    const restored = restoreConsoleState(JSON.parse(JSON.stringify({ sessionId: s.sessionId, entries: s.entries })));
    expect(restored.busy).toBe(false);
    expect(restored.sessionId).toBe('asst_9');
    expect((restored.entries[1] as Extract<ConsoleState['entries'][number], { kind: 'activity' }>).calls[0].status).toBe('interrupted');
    const next = consoleReducer(restored, { type: 'send', text: 'more' });
    expect(new Set(next.entries.map((e) => e.key)).size).toBe(next.entries.length);
  });

  it('ignores saved data that is not a conversation', () => {
    expect(restoreConsoleState({ nope: true })).toEqual(initialConsoleState);
    expect(restoreConsoleState(null)).toEqual(initialConsoleState);
    expect(restoreConsoleState({ sessionId: 'x', entries: [{ kind: 'weird' }] }).entries).toEqual([]);
  });

  it('starts over on reset', () => {
    const s = run(consoleReducer(initialConsoleState, { type: 'send', text: 'hi' }), { type: 'session', id: 'a' }, { type: 'done' });
    expect(consoleReducer(s, { type: 'reset' })).toEqual(initialConsoleState);
  });
});

// ---- starters ------------------------------------------------------------------------------------------

let n = 0;
const item = (name: string, section: string | null, prices: (number | null)[], extra: Partial<ItemWithVariants> = {}): ItemWithVariants => ({
  id: `itm_${++n}`, shopId: 'shp_1', section, name, description: null, sourceText: name, confidence: 'high', issues: [], issueDetail: null,
  kind: 'PHYSICAL', status: 'live', soldOut: false, sort: n, paypalProductId: `PROD-${n}`, publishedAt: null, updatedAt: '',
  variants: prices.map((p, i) => ({ id: `var_${n}_${i}`, itemId: `itm_${n}`, label: prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p, sort: i })),
  ...extra,
});

const marigold = () => [
  item('Country sourdough loaf', 'Breads', [900]),
  item('Seeded rye', 'Breads', [1050]),
  item('Focaccia – rosemary & sea salt', 'Breads', [800]),
  item('Butter croissant', 'Pastries', [425]),
  item('Almond croissant', 'Pastries', [500]),
  item('Cardamom bun', 'Pastries', [350]),
  item('Pain au chocolat', 'Pastries', [475]),
  item('Olive oil citrus cake – 8"', 'Cakes (24h notice)', [3800]),
  item('Seasonal fruit galette', 'Cakes (24h notice)', [null], { status: 'in_person' }),
  item('Drip coffee', 'Coffee', [300, 400]),
];

describe('starterPrompts', () => {
  it('derives three prompts from real menu items', () => {
    expect(starterPrompts({ kind: 'food', fulfillment: 'both' }, marigold())).toEqual([
      'Two butter croissants and a country sourdough loaf, shipped to me',
      'What pastries do you have?',
      'What sizes does the drip coffee come in?',
    ]);
  });

  it('asks for pickup when the shop does not ship, and skips sold-out or unpriced items', () => {
    const items = [
      item('Carnitas taco', 'Tacos', [350], { soldOut: true }),
      item('Al pastor taco', 'Tacos', [325]),
      item('Horchata', 'Drinks', [300]),
      item('Market fish', 'Specials', [null], { status: 'in_person' }),
    ];
    const prompts = starterPrompts({ kind: 'food', fulfillment: 'pickup' }, items);
    expect(prompts[0]).toBe('Two al pastor tacos and a horchata, for pickup');
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toBe('When and where is pickup?');
  });

  it('pluralises the last word sensibly', () => {
    const p = (name: string) => starterPrompts({ kind: 'food', fulfillment: 'shipping' }, [item(name, 'A', [100])])[0];
    expect(p('Country loaf')).toBe('Two country loaves, shipped to me');
    expect(p('Peach pie')).toBe('Two peach pies, shipped to me');
    expect(p('Cherry tart')).toBe('Two cherry tarts, shipped to me');
    expect(p('Brownie box')).toBe('Two brownie boxes, shipped to me');
    expect(p('Jam berry')).toBe('Two jam berries, shipped to me');
  });

  it('asks for a service plainly', () => {
    const prompts = starterPrompts({ kind: 'services', fulfillment: 'pickup' }, [item('Flat tire repair', 'Repairs', [1500], { kind: 'SERVICE' })]);
    expect(prompts[0]).toBe('I’d like a flat tire repair. How does it work?');
  });

  it('still offers questions for a shop with nothing orderable', () => {
    const prompts = starterPrompts({ kind: 'food', fulfillment: 'shipping' }, [item('Market fish', null, [null], { status: 'in_person' })]);
    expect(prompts).toEqual(["What's on the menu today?", 'How much is shipping?']);
  });
});

// ---- activity summaries ---------------------------------------------------------------------------------

describe('Activity summaries', () => {
  it('summarises arguments per tool', () => {
    expect(argSummary('get_shop_info', {})).toBe('no arguments');
    expect(argSummary('list_products', {})).toBe('whole menu');
    expect(argSummary('list_products', { query: 'croissant' })).toBe('query “croissant”');
    expect(argSummary('create_order', { items: [{ item_id: 'a', quantity: 2 }, { item_id: 'b', quantity: 1 }], fulfillment: 'shipping' })).toBe('3 items · shipping');
    expect(argSummary('create_order', { items: [{ item_id: 'a', quantity: 1 }] })).toBe('1 item');
    expect(argSummary('get_order_status', { order_ref: 'ord_imj327qi5gvgnbxk' })).toBe('order ord_imj327qi…');
    expect(argSummary('mystery', { a: 1 })).toBe('{"a":1}');
  });

  it('summarises results per tool, and errors by their code', () => {
    const ok = (name: string, result: unknown) => resultSummary({ id: 'x', name, input: {}, status: 'ok', result, ms: 1 });
    expect(ok('get_shop_info', { shop_name: 'Marigold Bakehouse', accepting_orders: true })).toBe('Marigold Bakehouse · taking orders');
    expect(ok('get_shop_info', { shop_name: 'Marigold Bakehouse', accepting_orders: false })).toBe('Marigold Bakehouse · not taking orders');
    expect(ok('list_products', { sections: [{ name: 'A', items: [{}, {}] }, { name: 'B', items: [{}] }] })).toBe('3 items in 2 sections');
    expect(ok('create_order', { order_number: 'SHF-KP3T5N', total: '27.00', status: 'awaiting_approval' })).toBe('SHF-KP3T5N · $27.00 · awaiting approval');
    expect(ok('get_order_status', { status: 'paid' })).toBe('paid');
    expect(resultSummary({ id: 'x', name: 'create_order', input: {}, status: 'error', result: { error: { code: 'OPTION_REQUIRED' } }, ms: 1 })).toBe('OPTION_REQUIRED');
    expect(resultSummary({ id: 'x', name: 'list_products', input: {}, status: 'running' })).toBe('waiting for the shop');
    expect(resultSummary({ id: 'x', name: 'list_products', input: {}, status: 'interrupted' })).toBe('no answer');
  });

  it('shows the request as the MCP tools/call it was', () => {
    expect(JSON.parse(requestJson('list_products', { query: 'bun' }))).toEqual({ method: 'tools/call', params: { name: 'list_products', arguments: { query: 'bun' } } });
  });

  it('only links approval URLs that point at PayPal over HTTPS', () => {
    expect(isPayPalApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=1')).toBe(true);
    expect(isPayPalApprovalUrl('https://www.paypal.com/checkoutnow?token=1')).toBe(true);
    expect(isPayPalApprovalUrl('http://www.sandbox.paypal.com/checkoutnow')).toBe(false);
    expect(isPayPalApprovalUrl('https://paypal.com.evil.example/x')).toBe(false);
    expect(isPayPalApprovalUrl('javascript:alert(1)')).toBe(false);
  });
});
