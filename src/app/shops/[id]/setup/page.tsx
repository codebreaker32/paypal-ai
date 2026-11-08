// /shops/[id]/setup: Reading → Review → Publishing → Live on one route (spec §4, Setup row).
// The step comes from the database on every request, so a refresh always lands on the right one.
import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { requireOwner } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as extractions from '@/lib/db/repos/extractions';
import * as items from '@/lib/db/repos/items';
import { loadSetupView } from '@/lib/catalog/setup';
import { loadShell } from '@/lib/seller/shell';
import { livePreview } from '@/lib/seller/live-preview';
import { itemPictures } from '@/lib/library/picture';
import { menuPhotoAvatarSrc } from '@/lib/domain/avatar';
import { isPendingPublish } from '@/lib/catalog/rules';
import { LiveStep } from '@/components/setup/LiveStep';
import { SetupFlow } from '@/components/setup/SetupFlow';

export const metadata: Metadata = {
  title: 'Set up your shop · Shelfie',
  robots: { index: false },
};

export default async function SetupPage({ params }: PageProps<'/shops/[id]/setup'>) {
  const { id } = await params;
  const shop = await requireOwner(id);
  const db = getDb();
  const view = loadSetupView(db, shop);

  if (view.step === 'live') {
    const appUrl = getConfig().appUrl;
    const all = items.listWithVariants(db, id);
    const { data, account } = await loadShell(shop);
    return (
      <AppShell data={data} account={account}>
        <LiveStep
          shopId={id}
          name={shop.name}
          slug={shop.slug}
          shell={data.values}
          shopUrl={`${appUrl}/s/${shop.slug}`}
          agentDoorUrl={`${appUrl}/s/${shop.slug}/mcp`}
          liveCount={all.filter((i) => i.status === 'live').length}
          inPersonCount={all.filter((i) => i.status === 'in_person').length}
          pendingCount={all.filter(isPendingPublish).length}
          pendingNames={all.filter(isPendingPublish).map((i) => i.name)}
          avatar={{
            shop: { logoUrl: shop.logoUrl, coverUrl: shop.coverUrl, kind: shop.kind, menuPhotoSrc: menuPhotoAvatarSrc(shop, 'owner') },
            items: items.avatarItems(db, id),
          }}
          preview={livePreview(all, itemPictures(all, shop.kind), shop.coverUrl)}
        />
      </AppShell>
    );
  }

  // A new reading (or a new step) gets a fresh client flow, with no leftover local state.
  const readingId = extractions.latest(db, id)?.id ?? 'none';
  return <SetupFlow key={`${readingId}:${view.step}`} view={view} />;
}
