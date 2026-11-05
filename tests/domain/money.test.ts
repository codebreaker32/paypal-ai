import { describe, expect, it } from 'vitest';
import { formatUSD, parseAmountToCents, toPayPalValue } from '@/lib/domain/money';

describe('money', () => {
  it.each([
    ['4.5', 450],
    ['$10.50', 1050],
    ['4,50', 450],
    ['4.50ea', 450],
    ['9', 900],
    [' $ 12 ', 1200],
    ['3 / 4.5', null],
    ['market price', null],
    ['?', null],
    ['', null],
    ['2 for $7', null],
  ])('parseAmountToCents(%j) → %j', (raw, cents) => {
    expect(parseAmountToCents(raw)).toBe(cents);
  });

  it('formats PayPal values with two decimals', () => {
    expect(toPayPalValue(425)).toBe('4.25');
    expect(toPayPalValue(900)).toBe('9.00');
    expect(toPayPalValue(5)).toBe('0.05');
  });

  it('rejects non-integer cents for PayPal', () => {
    expect(() => toPayPalValue(4.5)).toThrow();
  });

  it('formats USD for people', () => {
    expect(formatUSD(2675)).toBe('$26.75');
    expect(formatUSD(800)).toBe('$8.00');
  });
});
