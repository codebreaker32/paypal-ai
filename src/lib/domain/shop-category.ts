// What a shop sells, in the few words /browse filters by (`shops.category`, nullable: a shop without one shows under All).

export const SHOP_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'repairs', label: 'Repairs' },
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id'];

const BY_ID = new Map<string, ShopCategory>(SHOP_CATEGORIES.map((c) => [c.id, c.id]));

/** A stored value as one of the categories (any case or spacing), or null for none or one we don't list. */
export function parseShopCategory(raw: unknown): ShopCategory | null {
  if (typeof raw !== 'string') return null;
  return BY_ID.get(raw.trim().toLowerCase()) ?? null;
}

export const shopCategoryLabel = (id: ShopCategory): string => SHOP_CATEGORIES.find((c) => c.id === id)!.label;
