// From 1024 px exactly one order button shows (hero, else compact), and neither while the assistant is docked.
import { describe, expect, it } from 'vitest';
import { orderCtaShown } from '@/components/shop/OrderCta';

describe('orderCtaShown', () => {
  it('shows the hero button while the hero is in view', () => {
    expect(orderCtaShown({ docked: false, heroInView: true })).toBe('hero');
  });

  it('shows the compact button once the hero has scrolled out', () => {
    expect(orderCtaShown({ docked: false, heroInView: false })).toBe('compact');
  });

  it.each([true, false])('shows neither while docked (hero in view: %s)', (heroInView) => {
    expect(orderCtaShown({ docked: true, heroInView })).toBeNull();
  });
});
