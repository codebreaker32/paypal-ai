import { describe, expect, it } from 'vitest';
import { cardKindFor, firstAmountIn, isPublishable, parsePriceInput, priceInputValue } from '@/lib/catalog/rules';
import type { IssueCode, ItemStatus } from '@/lib/domain/types';

const item = (issues: IssueCode[], prices: (number | null)[], status: ItemStatus = 'draft') => ({
  status, issues, paypalProductId: null, variants: prices.map((priceCents) => ({ priceCents })),
});

describe('catalog rules', () => {
  it('parses what people type on a decimal keypad into cents', () => {
    expect(parsePriceInput('4.5')).toBe(450);
    expect(parsePriceInput('4.50')).toBe(450);
    expect(parsePriceInput('$12')).toBe(1200);
    expect(parsePriceInput(' 3,25 ')).toBe(325);
    expect(parsePriceInput('.75')).toBe(75);
    expect(parsePriceInput('0')).toBe(0);
    expect(parsePriceInput('1000')).toBe(100_000);
    for (const bad of ['', 'abc', '4.555', '1000.01', '-2', '4.5.0', '12 dollars']) expect(parsePriceInput(bad)).toBeNull();
  });

  it('turns cents back into an editable value', () => {
    expect(priceInputValue(450)).toBe('4.50');
    expect(priceInputValue(1200)).toBe('12');
    expect(priceInputValue(null)).toBe('');
  });

  it('finds a dollar amount in a skipped line', () => {
    expect(firstAmountIn('+$1.5 add guac')).toBe(150);
    expect(firstAmountIn('Tue-Sat 11-8')).toBeNull();
  });

  it('publishes only resolved, priced drafts', () => {
    expect(isPublishable(item([], [425]))).toBe(true);
    expect(isPublishable(item([], [300, 400]))).toBe(true);
    expect(isPublishable(item(['CHECK'], [425]))).toBe(false);
    expect(isPublishable(item([], [300, null]))).toBe(false);
    expect(isPublishable(item([], [425], 'in_person'))).toBe(false);
    expect(isPublishable(item([], [425], 'removed'))).toBe(false);
  });

  it('picks the one-thumb fix for a flagged card', () => {
    expect(cardKindFor(item(['MARKET_PRICE'], [null], 'in_person'))).toBe('market');
    expect(cardKindFor(item(['MISSING_PRICE'], [null]))).toBe('price');
    expect(cardKindFor(item(['DUPLICATE', 'MISSING_PRICE'], [null]))).toBe('price');
    expect(cardKindFor(item(['DUPLICATE'], [500]))).toBe('duplicate');
    expect(cardKindFor(item(['CHECK'], [800]))).toBe('check');
  });
});
