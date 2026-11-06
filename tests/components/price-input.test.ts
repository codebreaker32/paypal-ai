// The price field's error: it names the range a price must be in, now that $0 is turned down too.
import { describe, expect, it } from 'vitest';
import { PRICE_ERROR } from '@/components/setup/PriceInput';

describe('PRICE_ERROR', () => {
  it('names both ends of the range a price can be in', () => {
    expect(PRICE_ERROR).toMatch(/^Enter a price like 4\.50/);
    expect(PRICE_ERROR).toContain('$0.01');
    expect(PRICE_ERROR).toContain('$500');
  });
});
