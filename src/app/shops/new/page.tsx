import type { Metadata } from 'next';
import { StartActions } from '@/app/_start/StartActions';
import { PageHeader } from '@/components/app/PageHeader';
import { requireAccount } from '@/lib/auth/session';
import { addShopSamples } from '@/lib/brand/add-shop';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Add a shop · Shelfie', robots: { index: false } };

export default async function NewShopPage({ searchParams }: { searchParams: Promise<{ samples?: string | string[] }> }) {
  const account = await requireAccount('/shops/new');
  const shopCount = shops.listByAccount(getDb(), account.id).length;
  const first = shopCount === 0;
  const { samples } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-page px-gutter pt-6 pb-12 lg:pt-10">
      <div className="max-w-measure">
        <PageHeader
          title={first ? 'Add your shop' : 'Add a shop'}
          description="Take a photo of your price list. You’ll check it before anything goes live."
        />
        <StartActions samples={addShopSamples(shopCount, samples)} liveLink={false} />
      </div>
    </div>
  );
}
