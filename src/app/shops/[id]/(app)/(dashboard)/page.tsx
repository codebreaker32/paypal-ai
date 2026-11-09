// Seller dashboard (spec §4): Orders · Menu · Share · Settings. Owner only; reads SQLite, then the client re-reads its API every 5 s.
import type { Metadata } from 'next';
import { withFallbackBrief } from '@/lib/ai/template';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { qrSvg } from '@/lib/discovery/qr';
import { currentShellAccount } from '@/lib/seller/shell';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import { paypalLooksUnreachable } from '@/lib/seller/health';
import { isDemoShop } from '@/lib/domain/payee';
import { sectionFromTab, sectionTitle } from '@/lib/seller/shell-view';

export async function generateMetadata({ params, searchParams }: PageProps<'/shops/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { tab } = await searchParams;
  const shop = await getOwnedShop(id).catch(() => null);
  return { title: shop ? sectionTitle(sectionFromTab(typeof tab === 'string' ? tab : null), shop.name) : 'Dashboard · Shelfie', robots: { index: false } };
}

export default async function DashboardPage({ params }: PageProps<'/shops/[id]'>) {
  const { id } = await params;
  const shop = await requireOwner(id);
  const db = getDb();
  const orders = ordersRepo.listByShop(db, shop.id);
  const items = itemsRepo.listWithVariants(db, shop.id);
  const appUrl = getConfig().appUrl;
  // A draft's address is replaced at first publish, so neither it nor a QR code of it reaches the page.
  const draft = shop.status === 'draft';
  const slug = draft ? '' : shop.slug;
  const [shareQr, account] = await Promise.all([draft ? null : qrSvg(`${appUrl}/s/${shop.slug}`), currentShellAccount()]);

  return (
    <Dashboard
      shop={{ id: shop.id, name: shop.name, slug, status: shop.status, payeeEmail: shop.payeeEmail, isDemo: isDemoShop(shop), coverUrl: shop.coverUrl, logoUrl: shop.logoUrl, kind: shop.kind }}
      initialOrders={orders.map((o) => withFallbackBrief(o))}
      initialItems={items}
      initialPaypalReachable={!paypalLooksUnreachable(db, orders)}
      appUrl={appUrl}
      shareQr={shareQr}
      accountEmail={account?.email ?? null}
    />
  );
}
