import type { Metadata } from 'next';
import { BrowseShops } from '@/components/browse/BrowseShops';
import { ShopCard, hasPhotoCover } from '@/components/browse/ShopCard';
import { ButtonLink } from '@/components/ui/button';
import { parseBrowseFilter } from '@/lib/browse';
import { getDb } from '@/lib/db';
import { listBrowseShops, type BrowseShop } from '@/lib/db/repos/browse';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Browse shops · Shelfie',
  description: 'Small shops on Shelfie that are taking orders. Order on the page or through any AI assistant, and pay with PayPal.',
};

function readShops(): BrowseShop[] {
  try {
    // Shops with photos lead (a stable sort keeps newest first within each group): the page opens on real pictures.
    return listBrowseShops(getDb()).sort((a, b) => Number(hasPhotoCover(b)) - Number(hasPhotoCover(a)));
  } catch (err) {
    console.error('Browse: could not read the shops', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Every shop taking orders right now (the same list as /agents.txt), searchable by name or item, filtered by category. */
export default async function BrowsePage({ searchParams }: PageProps<'/browse'>) {
  const { q, category } = await searchParams;
  const shops = readShops();
  return (
    <>
      <section aria-labelledby="browse-title" className="bg-blush">
        <div className="mx-auto w-full max-w-site px-band-gutter pt-band pb-8 lg:pb-10">
          <h1 id="browse-title" className="type-band text-balance text-ink">
            Browse shops
          </h1>
          <p className="mt-3 max-w-measure text-lg text-ink-soft xl:text-xl">
            Small shops taking orders on Shelfie. Order on the page or through your AI assistant, and pay with PayPal.
          </p>
        </div>
      </section>
      <section aria-label="Shops" className="flex-1 bg-gradient-to-b from-blush to-surface to-50%">
        <div className="mx-auto w-full max-w-site px-band-gutter pt-2 pb-band">
          {shops.length ? (
            <BrowseShops
              initialQuery={typeof q === 'string' ? q : ''}
              initialFilter={parseBrowseFilter(category)}
              cards={shops.map((shop) => ({ slug: shop.slug, name: shop.name, category: shop.category, itemNames: shop.itemNames, card: <ShopCard shop={shop} /> }))}
            />
          ) : (
            <div className="flex flex-col items-start gap-4 py-8">
              <p className="text-xl font-bold text-ink">No shops are taking orders right now.</p>
              <ButtonLink href="/signup" variant="brand" size="lg">
                Add your shop
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
