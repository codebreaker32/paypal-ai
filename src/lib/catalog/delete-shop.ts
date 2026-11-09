// Deleting a shop for good (SR19): rows and slug in the caller's transaction, then its files once that has committed.
// Only files this shop owns are touched: its upload folder and the exact "/i/<file>" URLs on its rows, never a bundled
// /demo/ or /samples/ photo, and never the library cache other shops share.
import fs from 'node:fs/promises';
import type { Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import type { Shop } from '@/lib/domain/types';
import { uploadFilePath } from '@/lib/uploads';
import { uploadedPhotoFile, uploadedPhotoPath } from './photos';

export function openOrdersMessage(open: number): string {
  return open === 1
    ? '1 order is still open. Hand it over, or wait for an unpaid one to expire (up to an hour), then try again.'
    : `${open} orders are still open. Hand them over, or wait for unpaid ones to expire (up to an hour), then try again.`;
}

/**
 * Removes the shop's rows and retires its slug. Call inside a transaction, after the open-order check in that same
 * transaction. Returns the absolute paths to pass to `removeFiles` once it has committed: a rollback must leave them.
 */
export function deleteShopRows(db: Db, shop: Shop): string[] {
  const urls = [...items.photoUrls(db, shop.id), shop.coverUrl, shop.logoUrl];
  const photos = urls.flatMap((url) => {
    const file = uploadedPhotoFile(url);
    const abs = file && uploadedPhotoPath(file);
    return abs ? [abs] : [];
  });
  const paths = [...photos, uploadFilePath(shop.id)];
  shops.deleteAndRetireSlug(db, shop);
  return paths;
}

export type DeleteAccountOutcome = { blocked: string } | { paths: string[] };

/**
 * Removes the account, every shop it owns and its sessions, retiring each slug. Call inside a transaction. `blocked` is
 * the message naming the shops with open orders, and nothing has changed; `paths` go to `removeFiles` after the commit.
 */
export function deleteAccountRows(db: Db, accountId: string): DeleteAccountOutcome {
  const owned = shops.listByAccount(db, accountId);
  const open = owned.flatMap((shop) => {
    const n = orders.countUnfinished(db, shop.id);
    return n > 0 ? [`${shop.name} (${n})`] : [];
  });
  if (open.length > 0) {
    return { blocked: `Orders are still open at ${open.join(', ')}. Hand them over, or wait for unpaid ones to expire (up to an hour), then try again.` };
  }
  const paths = owned.flatMap((shop) => deleteShopRows(db, shop));
  accounts.deleteRow(db, accountId);
  return { paths };
}

/** Never throws: the rows are already gone, and a stale file is only disk space. */
export async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => fs.rm(p, { recursive: true, force: true }).catch(() => undefined)));
}
