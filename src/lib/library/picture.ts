import { itemCategory, type ItemCategory, type ItemPicture } from '@/lib/domain/category';
import type { ShopKind } from '@/lib/domain/types';
import { exampleUrls, type ShopItem } from './match';
import { LIBRARY } from './catalog';
import type { LibraryPhoto } from './types';

/**
 * The one place that decides what an item's picture is (Part A3), in this order: the seller's own photo (`photoUrl`,
 * which also holds a "Snap your counter" crop they kept), else an example photo from the library (`exampleUrls`), else
 * the drawing of its category. Every surface that shows an item (shop tile, setup review, Menu tab, order pages) reads
 * it through here. For people only: agents and the JSON-LD send `photoUrl` and nothing else.
 */

export type PictureSource = 'own' | 'example' | 'drawing';

type PictureItem = {
  name: string;
  section: string | null;
  description: string | null;
  category: ItemCategory | null;
  photoUrl: string | null;
};

/** One item's picture, given its example from the whole-menu match (`exampleUrls`). */
export function pictureOf(item: PictureItem, shopKind: ShopKind, exampleUrl: string | null | undefined): ItemPicture {
  const photoUrl = item.photoUrl || null;
  return { photoUrl, exampleUrl: photoUrl ? null : (exampleUrl ?? null), category: itemCategory(item, shopKind) };
}

/** Which of the three a picture shows. */
export function pictureSource(p: ItemPicture): PictureSource {
  if (p.photoUrl) return 'own';
  if (p.exampleUrl) return 'example';
  return 'drawing';
}

/** The image a picture shows, or null for the drawing. */
export function pictureSrc(p: ItemPicture): string | null {
  return p.photoUrl || p.exampleUrl || null;
}

/** Every item's picture for one shop, keyed by item id; examples are matched across the whole menu. */
export function itemPictures<T extends ShopItem & PictureItem>(
  items: readonly T[],
  shopKind: ShopKind,
  library: readonly LibraryPhoto[] = LIBRARY,
): Map<string, ItemPicture> {
  const examples = exampleUrls(items, shopKind, library);
  return new Map(items.map((i) => [i.id, pictureOf(i, shopKind, examples.get(i.id))]));
}
