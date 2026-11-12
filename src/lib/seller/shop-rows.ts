// The rows of /shops. Server side: ShopRow and the page render from this.
import type { ShopAvatarProps } from '@/components/shop/ShopAvatar';
import { getDb, type Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import { menuPhotoAvatarSrc } from '@/lib/domain/avatar';
import { canBePaid } from '@/lib/domain/payee';
import type { ShopStatus } from '@/lib/domain/types';
import { shopStatusWord } from './shell-view';

export interface ShopRowData {
  id: string;
  name: string;
  href: string;
  status: ReturnType<typeof shopStatusWord>;
  toPrepare: number;
  createdAt: string;
  avatar: Pick<ShopAvatarProps, 'shop' | 'items'>;
}

/** Most to prepare first, then newest; `sort` is stable, so a full tie keeps the order given. */
export function sortShopRows<T extends Pick<ShopRowData, 'toPrepare' | 'createdAt'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.toPrepare - a.toPrepare || b.createdAt.localeCompare(a.createdAt));
}

export function shopRowStatus(status: ShopStatus, payeeMissing: boolean): ReturnType<typeof shopStatusWord> {
  return status === 'draft' ? { tone: 'neutral', word: 'Not published yet' } : shopStatusWord(status, payeeMissing);
}

/** A draft has no dashboard worth opening yet: its row goes on with setup. */
export const shopRowHref = (id: string, status: ShopStatus): string => (status === 'draft' ? `/shops/${id}/setup` : `/shops/${id}`);

/** The account's shops, in the order `/shops` lists them. */
export function loadShopRows(accountId: string, db: Db = getDb()): ShopRowData[] {
  const toPrepare = ordersRepo.paidCountsByAccount(db, accountId);
  return sortShopRows(
    shopsRepo.listByAccount(db, accountId).map((shop) => ({
      id: shop.id,
      name: shop.name,
      href: shopRowHref(shop.id, shop.status),
      status: shopRowStatus(shop.status, !canBePaid(shop)),
      toPrepare: toPrepare.get(shop.id) ?? 0,
      createdAt: shop.createdAt,
      avatar: {
        shop: { logoUrl: shop.logoUrl, coverUrl: shop.coverUrl, kind: shop.kind, menuPhotoSrc: menuPhotoAvatarSrc(shop, 'owner') },
        items: itemsRepo.avatarItems(db, shop.id),
      },
    })),
  );
}
