import type { ItemWithVariants, Variant } from '@/lib/domain/types';

export type TilePrice =
  | { kind: 'options'; options: { id: string; label: string | null; cents: number }[] }
  | { kind: 'from'; cents: number; count: number };

const priced = (item: ItemWithVariants): Variant[] => item.variants.filter((v) => v.priceCents !== null && v.priceCents > 0);

/** What a tile shows under the name: one or two options in full, three or more as `From $3.00 · 3 options`. */
export function tilePrice(item: ItemWithVariants): TilePrice | null {
  if (item.status === 'in_person') return null;
  const options = priced(item);
  if (!options.length) return null;
  if (options.length >= 3) {
    return { kind: 'from', cents: Math.min(...options.map((v) => v.priceCents!)), count: options.length };
  }
  return { kind: 'options', options: options.map((v) => ({ id: v.id, label: v.label, cents: v.priceCents! })) };
}

/**
 * The options a buyer can add to an order from this tile; empty when the tile takes no add control. The same rule as
 * `unavailableReason` in `lib/orders/pricing` (a test holds them together); that module pulls in the database repos,
 * so it isn't imported here.
 */
export function orderableOptions(item: ItemWithVariants, takesOrders: boolean): Variant[] {
  if (!takesOrders || item.status !== 'live' || item.soldOut) return [];
  return priced(item);
}
