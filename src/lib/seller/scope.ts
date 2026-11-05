// Tenant safety on the shared sandbox merchant (spec §8): the seller toolkit may only touch this shop's own ids.
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import type { ShopScope } from '@/lib/paypal/toolkit';

/** The PayPal order and product ids SQLite records as belonging to this shop, and nothing else. */
export function shopScope(db: Db, shopId: string): ShopScope {
  return {
    orderIds: new Set(ordersRepo.listByShop(db, shopId).map((o) => o.paypalOrderId)),
    productIds: new Set(
      itemsRepo
        .listWithVariants(db, shopId)
        .map((i) => i.paypalProductId)
        .filter((id): id is string => Boolean(id)),
    ),
  };
}
