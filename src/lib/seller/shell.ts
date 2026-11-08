// What the seller shell reads on the server (spec WP4). Pure rules live in shell-view.ts, which the browser can import.
import type { ShellValues } from '@/components/app/shell-store';
import { getDb, type Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import { menuPhotoAvatarSrc } from '@/lib/domain/avatar';
import type { ItemCategory } from '@/lib/domain/category';
import { canBePaid } from '@/lib/domain/payee';
import type { Shop, ShopKind } from '@/lib/domain/types';
import { paypalLooksUnreachable } from './health';

export interface ShellData {
  shopId: string;
  name: string;
  slug: string;
  /** For `ShopAvatar`: never letters. Logo and cover are live values, so the shell reads those from `values`. */
  avatar: {
    kind: ShopKind;
    menuPhotoSrc: string | null;
    items: { category: ItemCategory | null; name: string; section: string | null; description: string | null }[];
  };
  values: ShellValues;
}

export interface ShellAccount {
  email: string;
  recoveryUnsaved: boolean;
}

export function loadShellData(shop: Shop, db: Db = getDb()): ShellData {
  const orders = ordersRepo.listByShop(db, shop.id);
  return {
    shopId: shop.id,
    name: shop.name,
    slug: shop.slug,
    avatar: {
      kind: shop.kind,
      menuPhotoSrc: menuPhotoAvatarSrc(shop, 'owner'),
      items: itemsRepo.avatarItems(db, shop.id),
    },
    values: {
      toPrepare: orders.filter((o) => o.status === 'paid').length,
      status: shop.status,
      logoUrl: shop.logoUrl,
      coverUrl: shop.coverUrl,
      payeeMissing: !canBePaid(shop),
      paypalDown: paypalLooksUnreachable(db, orders),
      recoveryUnsaved: false,
    },
  };
}

/** The signed-in account, for the shell's account slot. Null until accounts land (WP5/6): every branch works with null. */
export async function currentShellAccount(): Promise<ShellAccount | null> {
  return null;
}

/** Everything `AppShell` needs, read once per request by the (app) layout and the Live step. */
export async function loadShell(shop: Shop): Promise<{ data: ShellData; account: ShellAccount | null }> {
  const account = await currentShellAccount();
  const data = loadShellData(shop);
  return { data: { ...data, values: { ...data.values, recoveryUnsaved: account?.recoveryUnsaved ?? false } }, account };
}
