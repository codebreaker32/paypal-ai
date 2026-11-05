// GET /api/shops/[id]/orders (owner): the shop's orders, newest first. SQLite only; the dashboard polls it every 5 s.
import { getOwnedShop } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';
import { paypalLooksUnreachable } from '@/lib/seller/health';
import { json, jsonError } from '@/lib/seller/http';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/api/shops/[id]/orders'>): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await getOwnedShop(id);
  if (!shop) return jsonError(404, 'NOT_FOUND', 'Shop not found.');
  const db = getDb();
  const orders = ordersRepo.listByShop(db, shop.id);
  return json({ orders, paypalReachable: !paypalLooksUnreachable(db, orders) });
}
