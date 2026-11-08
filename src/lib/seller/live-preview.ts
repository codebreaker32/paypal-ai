// What the Live step's preview card draws: the shop's real cover or first photo, and its first three live items.
import type { ItemPicture } from '@/lib/domain/category';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants, Variant } from '@/lib/domain/types';
import { pictureSource } from '@/lib/library/picture';

export interface LivePreviewRow {
  id: string;
  name: string;
  price: string;
  picture: ItemPicture;
}

export interface LivePreview {
  hero: { kind: 'cover'; src: string } | { kind: 'item'; item: LivePreviewRow } | null;
  rows: LivePreviewRow[];
}

/** One price, or "from" the lowest when the item comes in several. Empty when nothing is priced. */
export function previewPrice(variants: Pick<Variant, 'priceCents'>[]): string {
  const prices = variants.map((v) => v.priceCents).filter((c): c is number => c !== null && c > 0);
  if (!prices.length) return '';
  const lowest = formatUSD(Math.min(...prices));
  return prices.length > 1 ? `from ${lowest}` : lowest;
}

export function livePreview(items: readonly ItemWithVariants[], pictures: ReadonlyMap<string, ItemPicture>, coverUrl: string | null): LivePreview {
  const live = items
    .filter((i) => i.status === 'live')
    .map((i): LivePreviewRow => ({ id: i.id, name: i.name, price: previewPrice(i.variants), picture: pictures.get(i.id)! }));
  const hero = coverUrl
    ? ({ kind: 'cover', src: coverUrl } as const)
    : (() => {
        const item = live.find((r) => pictureSource(r.picture) === 'own') ?? live[0];
        return item ? ({ kind: 'item', item } as const) : null;
      })();
  return { hero, rows: live.slice(0, 3) };
}
