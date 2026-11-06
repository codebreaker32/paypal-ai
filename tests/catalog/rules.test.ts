import { describe, expect, it } from 'vitest';
import { MAX_PRICE_CENTS, cardKindFor, firstAmountIn, isPublishable, parseFeeInput, parsePriceInput, priceInputValue } from '@/lib/catalog/rules';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
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
    expect(parsePriceInput('0.01')).toBe(1);
    expect(parsePriceInput('500')).toBe(50_000);
    for (const bad of ['', 'abc', '4.555', '500.01', '1000', '-2', '4.5.0', '12 dollars']) expect(parsePriceInput(bad)).toBeNull();
  });

  it('turns down a $0 price, which the shop could never sell', () => {
    for (const zero of ['0', '0.00', '$0', '.0', '00']) expect(parsePriceInput(zero)).toBeNull();
    expect(firstAmountIn('free refill $0')).toBeNull();
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

  it('never publishes a price the shop cannot sell online ($0, or over the $500 order cap)', () => {
    expect(isPublishable(item([], [MAX_PRICE_CENTS]))).toBe(true);
    expect(isPublishable(item([], [0]))).toBe(false);
    expect(isPublishable(item([], [425, MAX_PRICE_CENTS + 1]))).toBe(false);
    // Such an item asks for a price again, even after "Looks right".
    expect(cardKindFor(item(['CHECK'], [65_000]))).toBe('price');
  });

  it('keeps the highest review price within a new shop’s online order cap', () => {
    const db = createTestDb();
    const { shop } = shops.create(db, { name: 'Cap check' });
    expect(MAX_PRICE_CENTS).toBeLessThanOrEqual(shop.orderCapCents);
  });

  it('picks the one-thumb fix for a flagged card', () => {
    expect(cardKindFor(item(['MARKET_PRICE'], [null], 'in_person'))).toBe('market');
    expect(cardKindFor(item(['MISSING_PRICE'], [null]))).toBe('price');
    expect(cardKindFor(item(['DUPLICATE', 'MISSING_PRICE'], [null]))).toBe('price');
    expect(cardKindFor(item(['DUPLICATE'], [500]))).toBe('duplicate');
    expect(cardKindFor(item(['CHECK'], [800]))).toBe('check');
  });
});

describe('parseFeeInput (the flat shipping fee)', () => {
  it('lets a seller ship for free: blank or 0 is $0, unlike an item price', () => {
    expect(parseFeeInput('')).toBe(0);
    expect(parseFeeInput('0')).toBe(0);
    expect(parseFeeInput('$0.00')).toBe(0);
    expect(parseFeeInput('8.50')).toBe(850);
    expect(parseFeeInput('eight')).toBeNull();
  });
});
