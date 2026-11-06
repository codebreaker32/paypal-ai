import { unstable_rethrow } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { ShopAvatar, type ShopAvatarProps } from '@/components/shop/ShopAvatar';
import { listOwnedShops } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import { StorePreview } from './_start/StorePreview';
import { StartActions } from './_start/StartActions';

/** A shop this browser owns, for the "Open your dashboard" shortcut. */
interface ReturningShop {
  id: string;
  name: string;
  /** What its picture is made from (never letters): logo, cover, menu photo, else the drawing of the items its shop page lists. */
  avatar: Pick<ShopAvatarProps, 'shop' | 'items'>;
}

async function getReturningShops(): Promise<ReturningShop[]> {
  try {
    const db = getDb();
    return (await listOwnedShops()).slice(0, 3).map((s) => ({
      id: s.id,
      name: s.name,
      avatar: {
        shop: { logoUrl: s.logoUrl, coverUrl: s.coverUrl, slug: s.slug, kind: s.kind, menuPhotoPaths: s.menuPhotoPaths },
        items: itemsRepo.avatarItems(db, s.id),
      },
    }));
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    // The start page must always render; a storage problem only hides the shortcut.
    console.error('Start page: could not read owned shops', err instanceof Error ? err.message : err);
    return [];
  }
}

function WelcomeBack({ shops }: { shops: ReturningShop[] }) {
  return (
    // A quiet row above the headline, divided off by a rule: the shop's mark, its name, and the way back in. No box.
    <section aria-labelledby="welcome-back" className="mb-8 flex flex-col gap-3 border-b border-line pb-5">
      <h2 id="welcome-back" className="type-label text-ink-muted">
        Welcome back
      </h2>
      <ul className="flex flex-col gap-3">
        {shops.map((shop) => (
          <li key={shop.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="flex min-w-0 items-center gap-3">
              <ShopAvatar {...shop.avatar} size="sm" menuPhotoSrc={`/api/shops/${shop.id}/photo/1`} />
              <span className="truncate text-lg font-bold">{shop.name}</span>
            </span>
            <ButtonLink href={`/shops/${shop.id}`} variant="secondary" icon={LayoutDashboard}>
              Open your dashboard
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function StartPage() {
  const returningShops = await getReturningShops();

  return (
    <div className="mx-auto grid w-full max-w-page items-start gap-12 px-gutter pt-8 pb-section lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-14">
      <section aria-labelledby="start-title" className="lg:col-span-6">
        {returningShops.length > 0 && <WelcomeBack shops={returningShops} />}
        <h1 id="start-title" className="type-hero max-w-[12ch]">
          Your price list, open to AI shoppers.
        </h1>
        <p className="mt-5 max-w-[30rem] type-lead text-ink-soft">
          Snap the paper menu on your counter. Shelfie turns it into a PayPal shop any AI assistant can order from.
        </p>
        <div className="mt-8">
          <StartActions />
        </div>
      </section>

      <div className="lg:col-span-6">
        <StorePreview />
      </div>
    </div>
  );
}
