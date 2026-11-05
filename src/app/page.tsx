import { unstable_rethrow } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listOwnedShops } from '@/lib/auth/owner';
import { OrderPreview } from './_start/OrderPreview';
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
    <Card as="section" aria-labelledby="welcome-back" tone="flat" className="mb-8 flex flex-col gap-3">
      <h2 id="welcome-back" className="type-label">
        Welcome back
      </h2>
      <ul className="flex flex-col gap-2">
        {shops.slice(0, 3).map((shop) => (
          <li key={shop.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="font-semibold">{shop.name}</span>
            <ButtonLink href={`/shops/${shop.id}`} variant="secondary" icon={LayoutDashboard}>
              Open your dashboard
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function StartPage() {
  const returningShops = await getReturningShops();

  return (
    <div className="mx-auto grid w-full max-w-page items-start gap-12 px-gutter pt-8 pb-section lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-12">
      <section aria-labelledby="start-title" className="lg:col-span-5">
        {returningShops.length > 0 && <WelcomeBack shops={returningShops} />}
        <h1 id="start-title" className="type-display">
          Your price list, open to AI shoppers.
        </h1>
        <p className="mt-4 max-w-measure type-lead text-ink-soft">
          Photograph your menu. Shelfie reads it and opens a PayPal shop any AI assistant can order from.
        </p>
        <div className="mt-8">
          <StartActions />
        </div>
      </section>

      <div className="lg:col-span-7">
        <OrderPreview />
      </div>
    </div>
  );
}
