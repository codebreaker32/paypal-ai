import { itemCategory, kindDefault, type ItemCategory } from './category';
import type { Shop } from './types';

export type ShopAvatarSource = { kind: 'logo' | 'cover' | 'menu'; src: string } | { kind: 'illustration'; category: ItemCategory };

type AvatarItem = { category: ItemCategory | null; name: string; section: string | null; description: string | null };

/**
 * What stands for a shop in a small round tile (shop page, dashboard header, the start page's list): always a picture,
 * never letters. The seller's logo, else their cover (cropped square by CSS), else the first photo of their menu
 * (already public at `/s/<slug>/photo/1`), else the drawing of the shop's most common item category (ties go to the
 * earliest item), else the shop kind's default drawing.
 */
export function shopAvatar(shop: Pick<Shop, 'logoUrl' | 'coverUrl' | 'slug' | 'menuPhotoPaths' | 'kind'>, items: AvatarItem[]): ShopAvatarSource {
  if (shop.logoUrl) return { kind: 'logo', src: shop.logoUrl };
  if (shop.coverUrl) return { kind: 'cover', src: shop.coverUrl };
  if (shop.menuPhotoPaths.length > 0) return { kind: 'menu', src: `/s/${shop.slug}/photo/1` };

  // A Map keeps first-seen order, so the strict `>` hands a tie to the category of the earliest item.
  const counts = new Map<ItemCategory, number>();
  for (const item of items) {
    const category = itemCategory(item, shop.kind);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  let best: ItemCategory | null = null;
  for (const [category, count] of counts) if (best === null || count > counts.get(best)!) best = category;
  return { kind: 'illustration', category: best ?? kindDefault(shop.kind) };
}
