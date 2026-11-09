import { describe, expect, it } from 'vitest';
import { sameShopName } from '@/lib/domain/shop-name';

describe('sameShopName', () => {
  it.each([
    ['Rosa’s Bakehouse', "Rosa's Bakehouse"],
    ["Rosa's Bakehouse", 'Rosa’s Bakehouse'],
    ['Rosa‘s', "Rosa's"],
    ['The “Good” Shop', 'The "Good" Shop'],
    ['Rosa  Tamales', 'Rosa Tamales'],
    ['Rosa Tamales', 'Rosa Tamales'],
    ['  Rosa  ', 'Rosa'],
    ['Tía Lupe’s Tacos', "Tía Lupe's Tacos"],
  ])('%s matches %s', (stored, typed) => {
    expect(sameShopName(typed, stored)).toBe(true);
  });

  it.each([
    ['Rosa', 'rosa'],
    ['Rosa', 'Rosas'],
    ['Rosa Tamales', 'RosaTamales'],
    ['Rosa', ''],
  ])('%s does not match %s', (stored, typed) => {
    expect(sameShopName(typed, stored)).toBe(false);
  });
});
