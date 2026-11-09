// What the seller shell reads on the server (spec WP4). Pure rules live in shell-view.ts, which the browser can import.
import { unstable_rethrow } from 'next/navigation';
import type { ShellValues } from '@/components/app/shell-store';
import { currentAccount } from '@/lib/auth/session';
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
    // A draft's address is replaced at first publish, so it must not reach the page.
    slug: shop.status === 'draft' ? '' : shop.slug,
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

/** The signed-in account, for the shell's account slot and recovery banner. Null for an owner-link seller: every branch works with null. */
export async function currentShellAccount(): Promise<ShellAccount | null> {
  try {
    const account = await currentAccount();
    return account ? { email: account.email, recoveryUnsaved: account.recoverySavedAt === null } : null;
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    // Like the public header: a storage problem only costs the account slot, the seller's page still renders.
    console.error('Shell: could not read the account', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Everything `AppShell` needs, read once per request by the (app) layout and the Live step. */
export async function loadShell(shop: Shop): Promise<{ data: ShellData; account: ShellAccount | null }> {
  const account = await currentShellAccount();
  const data = loadShellData(shop);
  return { data: { ...data, values: { ...data.values, recoveryUnsaved: account?.recoveryUnsaved ?? false } }, account };
}
