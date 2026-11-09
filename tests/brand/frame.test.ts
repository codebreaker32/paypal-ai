// Which pages use the wide container (the header's and footer's frame follows the page below it).
import { describe, expect, it } from 'vitest';
import { isWidePath } from '@/lib/brand/frame';

describe('isWidePath', () => {
  it.each(['/shops/shp_1', '/shops/shp_1/', '/shops/shp_1/orders/ord_1'])('%s is wide', (p) => {
    expect(isWidePath(p)).toBe(true);
  });
  it.each(['/shops', '/shops/new', '/shops/new/', '/account', '/', '/shops/shp_1/setup', '/shops/shp_1/card'])('%s is not', (p) => {
    expect(isWidePath(p)).toBe(false);
  });
  it('a shop id that merely starts with new is still a shop', () => {
    expect(isWidePath('/shops/newsagent')).toBe(true);
  });
});
