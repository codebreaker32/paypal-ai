export type ShopKind = 'food' | 'goods' | 'services';

/** PayPal catalog category: only food shops get one; other kinds omit it (a wrong category is a 400). */
export function categoryFor(shopKind: ShopKind): string | undefined {
  return shopKind === 'food' ? 'FOOD_RETAIL_AND_SERVICE' : undefined;
}
