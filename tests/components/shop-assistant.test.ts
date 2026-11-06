// The shop page's one primary action: the phone order bar names PayPal only when the shop takes orders.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShopAssistant } from '@/components/shop/ShopAssistant';

const render = (takesOrders: boolean) =>
  renderToStaticMarkup(
    createElement(ShopAssistant, { slug: 'marigold-bakehouse', shopName: 'Marigold', starters: [], initiallyOpen: false, intro: null, menu: null, door: null, takesOrders }),
  );

describe('ShopAssistant phone bar', () => {
  it('a shop taking orders: "Order with an assistant · PayPal"', () => {
    expect(render(true)).toContain(' · PayPal</span>');
  });

  it('a shop not taking orders: "Ask the assistant", no PayPal', () => {
    const html = render(false);
    expect(html).toContain('Ask the assistant');
    expect(html).not.toContain(' · PayPal</span>');
  });
});
