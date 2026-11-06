import { itemCategory, kindDefault, type ItemCategory } from './category';
import type { Shop } from './types';

export type ShopAvatarSource = { kind: 'logo' | 'cover' | 'menu'; src: string } | { kind: 'illustration'; category: ItemCategory };

/** What the shop's picture is chosen from. */
export type AvatarShop = Pick<Shop, 'logoUrl' | 'coverUrl' | 'kind'> & {
  /** Where its first menu photo is shown from (`menuPhotoAvatarSrc`), or null when it has none. */
  menuPhotoSrc: string | null;
};

type AvatarItem = { category: ItemCategory | null; name: string; section: string | null; description: string | null };

/**
 * Where the shop's picture shows its first menu photo from, or null when the shop has none. The shop page uses the
 * public route; the seller's own pages use the owner route, which also serves a draft's photo.
 */
export function menuPhotoAvatarSrc(shop: Pick<Shop, 'id' | 'slug' | 'menuPhotoPaths'>, route: 'public' | 'owner'): string | null {
  if (shop.menuPhotoPaths.length === 0) return null;
  return route === 'owner' ? `/api/shops/${shop.id}/photo/1` : `/s/${shop.slug}/photo/1`;
}

/**
 * What stands for a shop in a small round tile (shop page, dashboard header, the start page's list): always a picture,
 * never letters. The seller's logo, else their cover (cropped square by CSS), else the first photo of their menu (from
 * `menuPhotoSrc`, as given), else the drawing of the shop's most common item category (ties go to the earliest item),
 * else the shop kind's default drawing. `items` are the ones its shop page lists (`listedItems`).
 */
export function shopAvatar(shop: AvatarShop, items: AvatarItem[]): ShopAvatarSource {
  if (shop.logoUrl) return { kind: 'logo', src: shop.logoUrl };
  if (shop.coverUrl) return { kind: 'cover', src: shop.coverUrl };
  if (shop.menuPhotoSrc) return { kind: 'menu', src: shop.menuPhotoSrc };

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
