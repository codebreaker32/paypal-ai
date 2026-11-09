import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { RecoveryBanner } from '@/components/shops/RecoveryBanner';
import { ShopRow } from '@/components/shops/ShopRow';
import { ButtonLink } from '@/components/ui/button';
import { PanelList } from '@/components/ui/panel';
import { requireAccount } from '@/lib/auth/session';
import { loadShopRows } from '@/lib/seller/shop-rows';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Your shops · Shelfie', robots: { index: false } };

export default async function ShopsPage() {
  // The layout's check does not re-run on a client navigation, so the page checks too.
  const account = await requireAccount('/shops');
  const rows = loadShopRows(account.id);
  if (rows.length === 0) redirect('/shops/new');
  return (
    <>
      {account.recoverySavedAt === null && <RecoveryBanner />}
      <PageHeader
        title="Your shops"
        actions={
          <ButtonLink href="/shops/new" variant="primary" icon={Plus}>
            Add a shop
          </ButtonLink>
        }
      />
      <PanelList>
        {rows.map((row) => (
          <ShopRow key={row.id} row={row} />
        ))}
      </PanelList>
    </>
  );
}
