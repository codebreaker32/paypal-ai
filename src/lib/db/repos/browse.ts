// /browse: every shop a buyer can order from right now, with what its card needs. Same rule as /agents.txt and
// /llms.txt (`ORDERABLE_WHERE`, which is `takesOrders` in SQL), so a shop is on the page exactly when its door takes orders.
import type { Db } from '@/lib/db';
import { menuPhotoAvatarSrc, type AvatarShop } from '@/lib/domain/avatar';
import { isItemCategory, type ItemCategory } from '@/lib/domain/category';
import { LISTED_STATUSES } from '@/lib/domain/listed';
import { RESERVED_SLUG } from '@/lib/domain/payee';
import { parseShopCategory, type ShopCategory } from '@/lib/domain/shop-category';
import type { ShopFulfillment, ShopKind } from '@/lib/domain/types';
import { ORDERABLE_WHERE } from './shops';

export interface BrowseItem {
  name: string;
  section: string | null;
  description: string | null;
  category: ItemCategory | null;
}

export interface BrowseShop {
  slug: string;
  name: string;
  /** What /browse files it under; null shows it under All only. */
  category: ShopCategory | null;
  kind: ShopKind;
  fulfillment: ShopFulfillment;
  /** The seller's cover photo (site-relative), or null. */
  coverUrl: string | null;
  /** Up to three of the items' own photos, for a cover strip when there is no cover. */
  itemPhotos: string[];
  /** What `ShopAvatar` draws from: `shop` and `items`. */
  avatar: { shop: AvatarShop; items: BrowseItem[] };
  /** One short line: the seller's about text, else where to pick up, else what they sell. */
  line: string;
  /** The names of the items its shop page lists, in menu order (what the search also matches). */
  itemNames: string[];
}

interface Row {
  id: string; slug: string; name: string; about: string; kind: ShopKind; fulfillment: ShopFulfillment;
  pickup_notes: string; cover_url: string | null; logo_url: string | null; menu_photo_paths: string; category: string | null;
}

/** Seller text on one line (the card clamps it). */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** "Almond croissant, Sourdough loaf and Drip coffee, and more": the first three names. */
function sellsLine(names: string[]): string {
  if (names.length === 0) return '';
  const first = names.slice(0, 3);
  const list = first.length === 1 ? first[0] : `${first.slice(0, -1).join(', ')} and ${first[first.length - 1]}`;
  return `${list}${names.length > 3 ? ', and more' : ''}`;
}

function shopLine(row: Row, names: string[]): string {
  const about = oneLine(row.about);
  if (about) return about;
  const pickup = oneLine(row.pickup_notes);
  if (pickup && row.fulfillment !== 'shipping') return `Pickup: ${pickup}`;
  return sellsLine(names);
}

/**
 * Every live shop that takes orders, with its card's words and pictures: the example shop (Marigold, the one the home
 * chat, README and video use) first when it is listed, then newest first.
 */
export function listBrowseShops(db: Db): BrowseShop[] {
  const rows = db
    .prepare(
      `SELECT id, slug, name, about, kind, fulfillment, pickup_notes, cover_url, logo_url, menu_photo_paths, category
       FROM shops WHERE ${ORDERABLE_WHERE} ORDER BY slug = ? DESC, COALESCE(published_at, created_at) DESC, rowid DESC`,
    )
    .all(RESERVED_SLUG, RESERVED_SLUG) as Row[];
  const itemsOf = db.prepare(
    `SELECT name, section, description, category, photo_url FROM items
     WHERE shop_id = ? AND status IN (${LISTED_STATUSES.map(() => '?').join(',')}) ORDER BY sort`,
  );
  return rows.map((row) => {
    const items = (itemsOf.all(row.id, ...LISTED_STATUSES) as (Omit<BrowseItem, 'category'> & { category: string | null; photo_url: string | null })[]);
    const itemNames = items.map((i) => i.name);
    const menuPhotoPaths = JSON.parse(row.menu_photo_paths) as string[];
    return {
      slug: row.slug,
      name: row.name,
      category: parseShopCategory(row.category),
      kind: row.kind,
      fulfillment: row.fulfillment,
      coverUrl: row.cover_url,
      itemPhotos: items.flatMap((i) => (i.photo_url ? [i.photo_url] : [])).slice(0, 3),
      avatar: {
        shop: {
          logoUrl: row.logo_url,
          coverUrl: row.cover_url,
          kind: row.kind,
          menuPhotoSrc: menuPhotoAvatarSrc({ id: row.id, slug: row.slug, menuPhotoPaths }, 'public'),
        },
        items: items.map((i) => ({ name: i.name, section: i.section, description: i.description, category: isItemCategory(i.category) ? i.category : null })),
      },
      line: shopLine(row, itemNames),
      itemNames,
    };
  });
}
