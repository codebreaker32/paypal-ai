import { describe, expect, it } from 'vitest';
import { friendlyStep, statusWords } from '@/lib/assistant/friendly-steps';

const ok = (name: string, result: unknown) => friendlyStep({ name, status: 'ok', result });

describe('friendlyStep', () => {
  it('list_products: the number of items it returned, else "Checked the menu"', () => {
    expect(ok('list_products', { sections: [{ items: [{}, {}] }, { items: [{}] }] })).toEqual({ label: 'Found 3 items', state: 'done' });
    expect(ok('list_products', { sections: [{ items: [{}] }] }).label).toBe('Found 1 item');
    // One item is named, from the result.
    expect(ok('list_products', { sections: [{ items: [{ name: 'Almond croissant' }] }] }).label).toBe('Found Almond croissant');
    expect(ok('list_products', { sections: [] }).label).toBe('Checked the menu');
    expect(ok('list_products', {}).label).toBe('Checked the menu');
  });

  it('get_shop_info: "Looked up the shop"', () => {
    expect(ok('get_shop_info', { shop_name: 'Marigold', accepting_orders: true })).toEqual({ label: 'Looked up the shop', state: 'done' });
  });

  it('create_order: the real total and status in plain words', () => {
    expect(ok('create_order', { total: '27.00', status: 'awaiting_approval' }).label).toBe('Placed your order · $27.00 · waiting for your PayPal approval');
    expect(ok('create_order', { total: '1234.50', status: 'paid' }).label).toBe('Placed your order · $1234.50 · paid');
    // No total in the result: no number is made up.
    expect(ok('create_order', {}).label).toBe('Placed your order');
    expect(ok('create_order', { total: 'abc' }).label).toBe('Placed your order');
  });

  it('get_order_status: the real status', () => {
    expect(ok('get_order_status', { status: 'paid' }).label).toBe('Checked your order: paid');
    expect(ok('get_order_status', { status: 'payment_pending' }).label).toBe('Checked your order: payment pending at PayPal');
    expect(ok('get_order_status', { status: 'some_new_state' }).label).toBe('Checked your order: some new state');
    expect(ok('get_order_status', {}).label).toBe('Checked your order');
  });

  it('a failed call: a short plain error, never the error code', () => {
    const failed = friendlyStep({ name: 'create_order', status: 'error', result: { error: { code: 'OPTION_REQUIRED' } } });
    expect(failed).toEqual({ label: 'Couldn’t place the order. Try again.', state: 'error' });
    expect(friendlyStep({ name: 'list_products', status: 'error' }).label).toBe('Couldn’t check the menu. Try again.');
    expect(friendlyStep({ name: 'get_shop_info', status: 'interrupted' })).toEqual({ label: 'The shop didn’t answer', state: 'error' });
  });

  it('a running call: the present tense, state running', () => {
    expect(friendlyStep({ name: 'create_order', status: 'running' })).toEqual({ label: 'Placing your order…', state: 'running' });
    expect(friendlyStep({ name: 'list_products', status: 'running' }).label).toBe('Checking the menu…');
  });

  it('any other tool: a plain label, no tool name', () => {
    expect(ok('track_parcel', { x: 1 })).toEqual({ label: 'Asked the shop', state: 'done' });
    expect(friendlyStep({ name: 'track_parcel', status: 'running' }).label).toBe('Asking the shop…');
    expect(friendlyStep({ name: 'track_parcel', status: 'error' }).label).not.toMatch(/track_parcel/);
  });

  it('never shows a tool name, milliseconds or a call count', () => {
    for (const name of ['get_shop_info', 'list_products', 'create_order', 'get_order_status', 'other_tool']) {
      for (const status of ['running', 'ok', 'error', 'interrupted'] as const) {
        const { label } = friendlyStep({ name, status, result: { total: '5.00', status: 'paid', sections: [] } });
        expect(label).not.toMatch(/_|\bms\b|\bcalls?\b|agent door/);
      }
    }
  });
});

describe('statusWords', () => {
  it('maps order statuses to plain words', () => {
    expect(statusWords('awaiting_approval')).toBe('waiting for your PayPal approval');
    expect(statusWords('cancelled')).toBe('cancelled');
    expect(statusWords('fulfilled')).toBe('completed by the shop');
    expect(statusWords(undefined)).toBeNull();
  });
});
