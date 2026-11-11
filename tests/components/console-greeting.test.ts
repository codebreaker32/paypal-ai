// The console's empty state: a shop that isn't taking orders must not promise a PayPal approval (spec WP2).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleConversation, type BuyerConsoleApi } from '@/components/shop/BuyerConsole';

const api = {
  state: { entries: [], busy: false },
  send: vi.fn(),
  reset: vi.fn(),
} as unknown as BuyerConsoleApi;

const greeting = (takesOrders: boolean) =>
  renderToStaticMarkup(createElement(ConsoleConversation, { api, shopName: 'Rosa Bakes', starters: [], takesOrders })).replaceAll('<!-- -->', '');

describe('console greeting', () => {
  it('says how ordering works when the shop takes orders', () => {
    expect(greeting(true)).toContain('Hi! I’m the Shelfie assistant. Tell me what you’d like from Rosa Bakes, and you’ll approve the payment on PayPal.');
  });

  it('says the shop is not taking orders, and offers questions, when it is not', () => {
    const html = greeting(false);
    expect(html).toContain('Hi! I’m the Shelfie assistant. Rosa Bakes isn’t taking orders right now, but I can answer questions about the menu.');
    expect(html).not.toContain('approve the payment');
  });
});
