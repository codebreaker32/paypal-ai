// The dock's tab names the order's count only when the cart has something in it ("Your order 0" right after
// the assistant had placed an order read as if that order were empty).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DockSwitch } from '@/components/shop/DockSwitch';

const render = (count: number, itemsCents: number) =>
  renderToStaticMarkup(
    createElement(DockSwitch, { active: 'assistant', count, itemsCents, onSwitch: () => {}, ids: { assistant: 'a', order: 'o', panel: 'p' } }),
  );

describe('DockSwitch', () => {
  it('an empty cart shows no count pill and is named "Your order (empty)"', () => {
    const html = render(0, 0);
    expect(html).not.toContain('data-dock-count');
    expect(html).toContain('aria-label="Your order (empty)"');
  });

  it('a cart with items shows the count and the total', () => {
    const html = render(2, 900);
    expect(html).toContain('data-dock-count="2"');
    expect(html).toContain('$9.00');
    expect(html).toContain('aria-label="Your order 2 $9.00 (2 items)"');
  });
});
