// /shops/[id]/setup: Reading → Review → Publishing → Live on one route (spec §4, Setup row).
// The step comes from the database on every request, so a refresh always lands on the right one.
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getOwnedShop, ownerCookieName } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as extractions from '@/lib/db/repos/extractions';
import * as items from '@/lib/db/repos/items';
import { loadSetupView } from '@/lib/catalog/setup';
import { isPendingPublish } from '@/lib/catalog/rules';
import { LiveStep } from '@/components/setup/LiveStep';
import { SetupFlow } from '@/components/setup/SetupFlow';

export const metadata: Metadata = {
  title: 'Set up your shop · Shelfie',
  robots: { index: false },
};

export default async function SetupPage({ params }: PageProps<'/shops/[id]/setup'>) {
  const { id } = await params;
  const shop = await getOwnedShop(id);
  if (!shop) notFound();
  const db = getDb();
  const view = loadSetupView(db, shop);

  if (view.step === 'live') {
    const appUrl = getConfig().appUrl;
    const token = (await cookies()).get(ownerCookieName(id))?.value;
    const all = items.listWithVariants(db, id);
    return (
      <LiveStep
        shopId={id}
        name={shop.name}
        slug={shop.slug}
        status={shop.status}
        shopUrl={`${appUrl}/s/${shop.slug}`}
        agentDoorUrl={`${appUrl}/s/${shop.slug}/mcp`}
        ownerLink={token ? `${appUrl}/claim/${token}` : null}
        liveCount={all.filter((i) => i.status === 'live').length}
        inPersonCount={all.filter((i) => i.status === 'in_person').length}
        pendingCount={all.filter(isPendingPublish).length}
        pendingNames={all.filter(isPendingPublish).map((i) => i.name)}
        avatar={{
          shop: { logoUrl: shop.logoUrl, coverUrl: shop.coverUrl, slug: shop.slug, kind: shop.kind, menuPhotoPaths: shop.menuPhotoPaths },
          items: items.avatarItems(db, id),
          menuPhotoSrc: `/api/shops/${id}/photo/1`,
        }}
      />
    );
  }

  // A new reading (or a new step) gets a fresh client flow, with no leftover local state.
  const readingId = extractions.latest(db, id)?.id ?? 'none';
  return <SetupFlow key={`${readingId}:${view.step}`} view={view} />;
}
