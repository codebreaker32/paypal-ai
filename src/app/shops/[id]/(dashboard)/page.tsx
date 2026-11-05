// Seller dashboard (spec §4): Orders · Menu · Share. Owner only; reads SQLite, then the client re-reads its API every 5 s.
import type { Metadata } from 'next';
import { withFallbackBrief } from '@/lib/ai/template';
import { Dashboard, type DashboardTab } from '@/components/dashboard/Dashboard';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import { paypalLooksUnreachable } from '@/lib/seller/health';

export async function generateMetadata({ params }: PageProps<'/shops/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const shop = await getOwnedShop(id).catch(() => null);
  return { title: shop ? `${shop.name} · Dashboard · Shelfie` : 'Dashboard · Shelfie', robots: { index: false } };
}

export default async function DashboardPage({ params, searchParams }: PageProps<'/shops/[id]'>) {
  const { id } = await params;
  const { tab } = await searchParams;
  const shop = await requireOwner(id);
  const db = getDb();
  const orders = ordersRepo.listByShop(db, shop.id);
  const items = itemsRepo.listWithVariants(db, shop.id);
  const initialTab: DashboardTab = tab === 'menu' || tab === 'share' ? tab : 'orders';

  return (
    <Dashboard
      shop={{ id: shop.id, name: shop.name, slug: shop.slug, status: shop.status }}
      initialOrders={orders.map((o) => withFallbackBrief(o))}
      initialItems={items}
      initialPaypalReachable={!paypalLooksUnreachable(db, orders)}
      appUrl={getConfig().appUrl}
      initialTab={initialTab}
    />
  );
}
