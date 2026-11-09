import { describe, expect, it } from 'vitest';
import { ADD_SHOP_HREF, ADD_SHOP_SAMPLES_HREF, addShopSamples } from '@/lib/brand/add-shop';

describe('addShopSamples', () => {
  it('offers samples to an account with no shops', () => {
    expect(addShopSamples(0, undefined)).toBe('plain');
  });

  it('leaves them out once the account has a shop', () => {
    expect(addShopSamples(1, undefined)).toBe('none');
    expect(addShopSamples(3, 'no')).toBe('none');
  });

  it('offers them to any account that followed Try a sample menu instead', () => {
    expect(addShopSamples(1, '1')).toBe('plain');
    expect(addShopSamples(3, '1')).toBe('plain');
  });

  it('ignores a repeated query parameter', () => {
    expect(addShopSamples(1, ['1', '1'])).toBe('none');
  });
});

describe('the links out of setup', () => {
  // `/` redirects a logged-in seller back to the draft they are leaving, so setup's exits must never point there.
  it('go to the add-a-shop page, and the sample link asks for the samples', () => {
    expect(ADD_SHOP_HREF).toBe('/shops/new');
    expect(ADD_SHOP_SAMPLES_HREF).toBe('/shops/new?samples=1');
  });
});
