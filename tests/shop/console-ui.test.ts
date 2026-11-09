// Pure pieces of the buyer console UI: the event reducer, starter prompts and Activity summaries.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';
import type { ItemWithVariants } from '@/lib/domain/types';
import { argSummary, isPayPalApprovalUrl, requestJson, resultSummary } from '@/components/shop/activity-format';
import {
  approvalCard,
  collapsedActivityKeys,
  CONFIRM_POLL_FOR_MS,
  CONFIRM_POLL_MS,
  confirmingWithPayPal,
  consoleReducer,
  consoleToSave,
  firstFreshEntry,
  initialConsoleState,
  pollEvery,
  refsToCheck,
  restoreConsoleState,
  turnStartIndex,
  type CallStatus,
  type ConsoleState,
  type Entry,
} from '@/components/shop/console-state';
import type { OrderStatus } from '@/lib/domain/types';
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

  it('puts the approval card after the assistant’s words for that turn (“tap the PayPal button under this message”)', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'Yes' });
    s = run(
      s,
      { type: 'tool_call', id: 't1', name: 'create_order', input: {} },
      { type: 'tool_result', id: 't1', ok: true, result: {}, ms: 900 },
      { type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=1', total: '27.00', orderRef: 'ord_1' },
    );
    expect(s.entries.map((e) => e.kind)).toEqual(['user', 'activity']);
    s = run(s, { type: 'text', text: 'Tap the PayPal button under this message.' }, { type: 'done' });
    expect(s.entries.map((e) => e.kind)).toEqual(['user', 'activity', 'assistant', 'approval']);
    // A turn that breaks off still shows the approval it already got.
    let broken = run(consoleReducer(initialConsoleState, { type: 'send', text: 'Yes' }), {
      type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=2', total: '9.00', orderRef: 'ord_2',
    });
    broken = consoleReducer(broken, { type: 'fail', message: "The shop didn’t answer. Try again." });
    expect(broken.entries.map((e) => e.kind)).toEqual(['user', 'approval', 'error']);
  });

  it('shows error events and failures as error entries and stops being busy', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'hi' });
    s = run(s, { type: 'error', message: "The shop didn’t answer. Try again." });
    expect(s.busy).toBe(false);
    expect(s.entries.at(-1)).toMatchObject({ kind: 'error', message: "The shop didn’t answer. Try again." });
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

  it('keeps an approval card that was still waiting for the end of the turn across a reload', () => {
    // The buyer reloads while Claude is still writing after create_order: no done ever arrives.
    const s = run(
      consoleReducer(initialConsoleState, { type: 'send', text: 'Yes' }),
      { type: 'session', id: 'asst_2' },
      { type: 'tool_call', id: 't1', name: 'create_order', input: {} },
      { type: 'tool_result', id: 't1', ok: true, result: { order_ref: 'ord_a', status: 'awaiting_approval' }, ms: 900 },
      { type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=a', total: '9.00', orderRef: 'ord_a', orderNumber: 'SHF-AAAAAA' },
    );
    const restored = restoreConsoleState(JSON.parse(JSON.stringify(consoleToSave(s))));
    expect(restored.entries.map((e) => e.kind)).toEqual(['user', 'activity', 'approval']);
    expect(restored.entries.at(-1)).toMatchObject({ kind: 'approval', orderRef: 'ord_a', total: '9.00', orderNumber: 'SHF-AAAAAA' });
    expect(refsToCheck(restored)).toEqual(['ord_a']);
    expect(new Set(restored.entries.map((e) => e.key)).size).toBe(restored.entries.length);
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

  it('keeps a full conversation\'s error code, so the console can offer a new conversation', () => {
    let s = consoleReducer(initialConsoleState, { type: 'send', text: 'One more' });
    s = run(s, { type: 'session', id: 'asst_full' }, { type: 'error', message: 'This conversation is full. Start a new one to keep ordering.', code: 'CONVERSATION_FULL' });
    expect(s.entries.at(-1)).toMatchObject({ kind: 'error', code: 'CONVERSATION_FULL' });
    expect(restoreConsoleState(JSON.parse(JSON.stringify(s))).entries.at(-1)).toMatchObject({ kind: 'error', code: 'CONVERSATION_FULL' });
  });
});

// ---- approval cards follow their order ---------------------------------------------------------------

const APPROVAL = { type: 'approval', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=1', total: '27.00', orderRef: 'ord_1', orderNumber: 'SHF-AAAAAA' } as const;
const approvalOf = (s: ConsoleState, ref = 'ord_1') => s.entries.find((e): e is Extract<Entry, { kind: 'approval' }> => e.kind === 'approval' && e.orderRef === ref)!;
const placed = () =>
  run(consoleReducer(initialConsoleState, { type: 'send', text: 'Yes' }), { type: 'session', id: 'asst_1' }, APPROVAL, { type: 'text', text: 'Tap the PayPal button.' }, { type: 'done' });
const askStatus = (s: ConsoleState, id: string, result: Record<string, unknown>, ok = true) =>
  run(
    consoleReducer(s, { type: 'send', text: 'Did my payment go through?' }),
    { type: 'tool_call', id, name: 'get_order_status', input: { order_ref: 'ord_1' } },
    { type: 'tool_result', id, ok, result, ms: 300 },
    { type: 'done' },
  );

describe('entrances (which entries rise in as they arrive)', () => {
  const saved = () => {
    const s = run(consoleReducer(initialConsoleState, { type: 'send', text: 'hi' }), { type: 'session', id: 'asst_r' }, { type: 'text', text: 'Hello!' }, { type: 'done' });
    return restoreConsoleState(JSON.parse(JSON.stringify(consoleToSave(s))));
  };

  it('entries restored from sessionStorage show as they are; the ones after them rise in', () => {
    const back = consoleReducer(initialConsoleState, { type: 'restore', state: saved() });
    expect(back.restored).toBe(2);
    expect(firstFreshEntry(back, 0)).toBe(2);
    expect(firstFreshEntry(consoleReducer(back, { type: 'send', text: 'more' }), 0)).toBe(2);
  });

  it('what was already in the log when it was shown stays put too', () => {
    const s = run(consoleReducer(initialConsoleState, { type: 'send', text: 'hi' }), { type: 'text', text: 'Hello!' });
    expect(firstFreshEntry(s, 2)).toBe(2);
  });

  it('a reset forgets the restored conversation: every entry of the new one rises in (and its order total counts up)', () => {
    const back = consoleReducer(initialConsoleState, { type: 'restore', state: saved() });
    const fresh = consoleReducer(consoleReducer(back, { type: 'reset' }), { type: 'send', text: 'Start again' });
    expect(fresh.restored).toBe(0);
    expect(firstFreshEntry(fresh, 0)).toBe(0);
  });

  it('nothing about entrances is saved', () => {
    const back = consoleReducer(initialConsoleState, { type: 'restore', state: saved() });
    expect(consoleToSave(back)).not.toHaveProperty('restored');
  });
});

describe('turnStartIndex', () => {
  const e = (kind: Entry['kind'], key: number) => ({ kind, key }) as unknown as Entry;
  it('points at the first reply entry after the latest message (the Activity card)', () => {
    expect(turnStartIndex([e('user', 1), e('activity', 2), e('assistant', 3), e('user', 4), e('activity', 5), e('approval', 6)])).toBe(4);
  });
  it('points at the message itself while the reply has not started', () => {
    expect(turnStartIndex([e('user', 1), e('assistant', 2), e('user', 3)])).toBe(2);
  });
  it('is -1 for an empty conversation and 0 when there is no message', () => {
    expect(turnStartIndex([])).toBe(-1);
    expect(turnStartIndex([e('assistant', 1)])).toBe(0);
  });
});

describe('collapsedActivityKeys', () => {
  const user = (key: string): Entry => ({ kind: 'user', key, text: 'hi' });
  const said = (key: string): Entry => ({ kind: 'assistant', key, text: 'ok' });
  const activity = (key: string, ...statuses: CallStatus[]): Entry => ({
    kind: 'activity',
    key,
    calls: statuses.map((status, i) => ({ id: `${key}-${i}`, name: 'list_products', input: {}, status })),
  });
  const collapsed = (...entries: Entry[]) => [...collapsedActivityKeys(entries)];

  it('leaves the latest turn open', () => {
    expect(collapsed(user('u1'), activity('a1', 'ok', 'ok'), said('s1'))).toEqual([]);
  });
  it('collapses a finished Activity entry as soon as a newer turn starts', () => {
    expect(collapsed(user('u1'), activity('a1', 'ok', 'ok'), said('s1'), user('u2'))).toEqual(['a1']);
  });
  it('collapses every older entry, and only those', () => {
    expect(collapsed(user('u1'), activity('a1', 'ok'), user('u2'), activity('a2', 'ok'), said('s2'), user('u3'), activity('a3', 'ok'))).toEqual(['a1', 'a2']);
  });
  it('never collapses an entry with an errored call, even beside calls that worked', () => {
    expect(collapsed(user('u1'), activity('a1', 'ok', 'error'), user('u2'))).toEqual([]);
  });
  it('never collapses an entry with an interrupted call', () => {
    expect(collapsed(user('u1'), activity('a1', 'interrupted', 'ok'), user('u2'))).toEqual([]);
  });
  it('never collapses a call that never got an answer (the turn failed while it ran)', () => {
    expect(collapsed(user('u1'), activity('a1', 'running'), user('u2'))).toEqual([]);
  });
  it('is empty for a conversation with no messages', () => {
    expect(collapsed()).toEqual([]);
    expect(collapsed(activity('a1', 'ok'))).toEqual([]);
  });
});

describe('approval cards', () => {
  it('offer PayPal only while the order waits for approval; otherwise say what happened and link the receipt', () => {
    const card = (status?: OrderStatus, captureRefused?: boolean) => approvalCard({ status, captureRefused });
    expect(card()).toEqual({ approve: true });
    expect(card('awaiting_approval')).toEqual({ approve: true });
    expect(card('paid')).toEqual({ approve: false, label: 'Paid', tone: 'ok' });
    expect(card('fulfilled')).toEqual({ approve: false, label: 'Paid', tone: 'ok' });
    expect(card('approved')).toEqual({ approve: false, label: 'Confirming with PayPal', tone: 'info' });
    expect(card('payment_pending')).toEqual({ approve: false, label: 'Confirming with PayPal', tone: 'info' });
    expect(card('approved', true)).toEqual({ approve: false, label: 'Payment refused', tone: 'danger' });
    expect(card('failed')).toEqual({ approve: false, label: 'Payment refused', tone: 'danger' });
    expect(card('cancelled')).toEqual({ approve: false, label: 'Cancelled', tone: 'neutral' });
    expect(card('expired')).toEqual({ approve: false, label: 'Expired', tone: 'neutral' });
  });

  it('follow get_order_status results for the same order', () => {
    let s = placed();
    expect(approvalCard(approvalOf(s))).toEqual({ approve: true });
    s = askStatus(s, 't1', { order_ref: 'ord_1', status: 'awaiting_approval' });
    expect(approvalOf(s).status).toBe('awaiting_approval');
    s = askStatus(s, 't2', { order_ref: 'ord_1', status: 'paid' });
    expect(approvalCard(approvalOf(s))).toEqual({ approve: false, label: 'Paid', tone: 'ok' });
    // An error result, or a status for another order, changes nothing.
    expect(approvalOf(askStatus(s, 't3', { error: { code: 'ORDER_NOT_FOUND' } }, false)).status).toBe('paid');
    expect(approvalOf(askStatus(s, 't4', { order_ref: 'ord_other', status: 'cancelled' })).status).toBe('paid');
  });

  it('follow a capture PayPal refused, as get_order_status reports it, so the card stops saying "Confirming with PayPal"', () => {
    const refused = { approve: false, label: 'Payment refused', tone: 'danger' };
    // Read as approved while the capture was still running, then PayPal refused it.
    let s = consoleReducer(placed(), { type: 'order_status', orderRef: 'ord_1', status: 'approved', captureRefused: false });
    s = askStatus(s, 't1', { order_ref: 'ord_1', status: 'approved', capture_refused: true });
    expect(approvalCard(approvalOf(s))).toEqual(refused);
    expect(refsToCheck(s)).toEqual([]);
    // The console's own status check ran the capture, and PayPal refused it.
    expect(approvalCard(approvalOf(askStatus(placed(), 't2', { order_ref: 'ord_1', status: 'approved', capture_refused: true })))).toEqual(refused);
    // A capture that went through after all clears it.
    s = askStatus(s, 't3', { order_ref: 'ord_1', status: 'approved', capture_refused: false });
    expect(approvalCard(approvalOf(s))).toEqual({ approve: false, label: 'Confirming with PayPal', tone: 'info' });
  });

  it('follow a status read in the same turn as the order (the card is still held until the turn ends)', () => {
    const s = run(
      consoleReducer(initialConsoleState, { type: 'send', text: 'Yes, and check it' }),
      APPROVAL,
      { type: 'tool_call', id: 't1', name: 'get_order_status', input: { order_ref: 'ord_1' } },
      { type: 'tool_result', id: 't1', ok: true, result: { order_ref: 'ord_1', status: 'expired' }, ms: 10 },
      { type: 'done' },
    );
    expect(approvalOf(s).status).toBe('expired');
  });

  it('follow the order read from the receipt API (order_status), and only for that order', () => {
    let s = placed();
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_other', status: 'paid' });
    expect(approvalOf(s).status).toBeUndefined();
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'approved', captureRefused: true });
    expect(approvalCard(approvalOf(s))).toEqual({ approve: false, label: 'Payment refused', tone: 'danger' });
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'paid', captureRefused: false });
    expect(approvalCard(approvalOf(s))).toEqual({ approve: false, label: 'Paid', tone: 'ok' });
  });

  it('keep their order status across a reload (sessionStorage), dropping anything that is not a status', () => {
    const s = consoleReducer(placed(), { type: 'order_status', orderRef: 'ord_1', status: 'paid', captureRefused: false });
    expect(approvalOf(restoreConsoleState(JSON.parse(JSON.stringify(s)))).status).toBe('paid');
    const bad = JSON.parse(JSON.stringify(s));
    bad.entries.find((e: { kind: string }) => e.kind === 'approval').status = 'teleported';
    expect(approvalOf(restoreConsoleState(bad)).status).toBeUndefined();
  });

  it('lists the orders worth re-reading: the ones PayPal may still move, once each', () => {
    let s = placed();
    s = run(consoleReducer(s, { type: 'send', text: 'And another' }), { ...APPROVAL, orderRef: 'ord_2' }, { ...APPROVAL, orderRef: 'ord_1' }, { type: 'done' });
    expect(refsToCheck(s)).toEqual(['ord_1', 'ord_2']);
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_2', status: 'approved' });
    expect(refsToCheck(s)).toEqual(['ord_1', 'ord_2']);
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'paid' });
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_2', status: 'approved', captureRefused: true });
    expect(refsToCheck(s)).toEqual([]);
  });
});

describe('cards confirming with PayPal', () => {
  afterEach(() => vi.useRealTimers());

  it('are spotted only while some card says "Confirming with PayPal"', () => {
    let s = placed();
    expect(confirmingWithPayPal(s)).toBe(false);
    s = consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'approved' });
    expect(confirmingWithPayPal(s)).toBe(true);
    expect(confirmingWithPayPal(consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'payment_pending' }))).toBe(true);
    expect(confirmingWithPayPal(consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'approved', captureRefused: true }))).toBe(false);
    expect(confirmingWithPayPal(consoleReducer(s, { type: 'order_status', orderRef: 'ord_1', status: 'paid' }))).toBe(false);
  });

  it('are re-read every 3 s, each wait starting after the last check, until stopped', async () => {
    vi.useFakeTimers();
    expect(CONFIRM_POLL_MS).toBe(3000);
    let checks = 0;
    const stop = pollEvery(CONFIRM_POLL_MS, async () => {
      checks++;
    });
    await vi.advanceTimersByTimeAsync(2999);
    expect(checks).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(checks).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(checks).toBe(2);
    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(checks).toBe(2);
  });
  it('stop on their own after 2 minutes (a payment PayPal holds as pending can take days)', async () => {
    vi.useFakeTimers();
    expect(CONFIRM_POLL_FOR_MS).toBe(120_000);
    let checks = 0;
    pollEvery(CONFIRM_POLL_MS, async () => {
      checks++;
    }, CONFIRM_POLL_FOR_MS);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(checks).toBe(40);
  });
});

// ---- starters ------------------------------------------------------------------------------------------

let n = 0;
const item = (name: string, section: string | null, prices: (number | null)[], extra: Partial<ItemWithVariants> = {}): ItemWithVariants => ({
  id: `itm_${++n}`, shopId: 'shp_1', section, name, description: null, sourceText: name, confidence: 'high', issues: [], issueDetail: null,
  kind: 'PHYSICAL', status: 'live', soldOut: false, photoUrl: null, category: null, examplePhoto: null, sort: n, paypalProductId: `PROD-${n}`, publishedAt: null, updatedAt: '',
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
    expect(starterPrompts({ kind: 'food', fulfillment: 'both' }, marigold(), { takesOrders: true })).toEqual([
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
    const prompts = starterPrompts({ kind: 'food', fulfillment: 'pickup' }, items, { takesOrders: true });
    expect(prompts[0]).toBe('Two al pastor tacos and a horchata, for pickup');
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toBe('When and where is pickup?');
  });

  it('pluralises the last word sensibly', () => {
    const p = (name: string) => starterPrompts({ kind: 'food', fulfillment: 'shipping' }, [item(name, 'A', [100])], { takesOrders: true })[0];
    expect(p('Country loaf')).toBe('Two country loaves, shipped to me');
    expect(p('Peach pie')).toBe('Two peach pies, shipped to me');
    expect(p('Cherry tart')).toBe('Two cherry tarts, shipped to me');
    expect(p('Brownie box')).toBe('Two brownie boxes, shipped to me');
    expect(p('Jam berry')).toBe('Two jam berries, shipped to me');
  });

  it('asks for a service plainly', () => {
    const prompts = starterPrompts({ kind: 'services', fulfillment: 'pickup' }, [item('Flat tire repair', 'Repairs', [1500], { kind: 'SERVICE' })], {
      takesOrders: true,
    });
    expect(prompts[0]).toBe('I’d like a flat tire repair. How does it work?');
  });

  it('still offers questions for a shop with nothing orderable', () => {
    const prompts = starterPrompts({ kind: 'food', fulfillment: 'shipping' }, [item('Market fish', null, [null], { status: 'in_person' })], {
      takesOrders: true,
    });
    expect(prompts).toEqual(["What’s on the menu today?", 'How much is shipping?']);
  });

  // A paused shop, or a live one with nowhere to be paid (takesOrders false): the door refuses every order, so the
  // console doesn't start one.
  it('offers only questions when the shop isn’t taking orders', () => {
    expect(starterPrompts({ kind: 'food', fulfillment: 'both' }, marigold(), { takesOrders: false })).toEqual([
      'What pastries do you have?',
      'What sizes does the drip coffee come in?',
    ]);
    const pickup = [item('Al pastor taco', 'Tacos', [325]), item('Horchata', 'Drinks', [300])];
    expect(starterPrompts({ kind: 'food', fulfillment: 'pickup' }, pickup, { takesOrders: false })).toEqual([
      'What tacos do you have?',
      'When and where is pickup?',
    ]);
  });

  it('asks for no service when the shop isn’t taking orders', () => {
    const repairs = [item('Flat tire repair', 'Repairs', [1500], { kind: 'SERVICE' })];
    expect(starterPrompts({ kind: 'services', fulfillment: 'pickup' }, repairs, { takesOrders: false })).toEqual([
      'What repairs do you have?',
      'When and where is pickup?',
    ]);
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
