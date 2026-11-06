import { unstable_rethrow } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { monogram } from '@/components/shop/ItemPhoto';
import { listOwnedShops } from '@/lib/auth/owner';
import { StorePreview } from './_start/StorePreview';
import { StartActions } from './_start/StartActions';

/** A shop this browser owns, for the "Open your dashboard" shortcut. */
interface ReturningShop {
  id: string;
  name: string;
}

async function getReturningShops(): Promise<ReturningShop[]> {
  try {
    return (await listOwnedShops()).map((s) => ({ id: s.id, name: s.name }));
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
        {shops.slice(0, 3).map((shop) => (
          <li key={shop.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-(--thumb-radius) bg-accent font-extrabold text-on-accent">
                {monogram(shop.name)}
              </span>
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
