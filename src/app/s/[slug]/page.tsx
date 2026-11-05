import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { PauseCircle, Store, Truck } from 'lucide-react';
import { AgentDoor } from '@/components/shop/AgentDoor';
import { Menu, menuSections } from '@/components/shop/Menu';
import { ShopAssistant } from '@/components/shop/ShopAssistant';
import { starterPrompts } from '@/components/shop/starters';
import { Icon } from '@/components/ui/Icon';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { formatUSD } from '@/lib/domain/money';
import type { Shop } from '@/lib/domain/types';

/** Published shops only: drafts and unknown slugs are 404. */
function loadShop(slug: string): Shop {
  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || shop.status === 'draft') notFound();
  return shop;
}

export async function generateMetadata({ params }: PageProps<'/s/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || shop.status === 'draft') return { title: 'Shop not found · Shelfie' };
  return {
    title: `${shop.name} · Shelfie`,
    description: shop.about || `Order from ${shop.name} with any AI assistant, and pay with PayPal.`,
  };
}

function HowToGetIt({ shop }: { shop: Shop }) {
  const pickup = shop.fulfillment !== 'shipping';
  const shipping = shop.fulfillment !== 'pickup';
  return (
    <section aria-labelledby="get-it-title" className="flex flex-col gap-3">
      <h2 id="get-it-title" className="type-label text-ink-soft">
        How to get it
      </h2>
      <dl className="flex flex-col gap-3">
        {pickup && (
          <div>
            <dt className="flex items-center gap-3 font-semibold">
              <Icon icon={Store} className="text-ink-soft" />
              Pickup
            </dt>
            <dd className="pl-8 text-ink-soft">{shop.pickupNotes || 'Ask the shop when and where to pick up.'}</dd>
          </div>
        )}
        {shipping && (
          <div>
            <dt className="flex items-center gap-3 font-semibold">
              <Icon icon={Truck} className="text-ink-soft" />
              Shipping
            </dt>
            <dd className="pl-8 text-ink-soft">
              <span className="type-price">{shop.shippingFeeCents > 0 ? `${formatUSD(shop.shippingFeeCents)} flat` : 'Free'}</span>{' '}
              per order, to the address on your PayPal account.
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function Intro({ shop, photoCount }: { shop: Shop; photoCount: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="type-display [overflow-wrap:anywhere]">{shop.name}</h1>
          {shop.about && <p className="mt-3 max-w-measure type-lead text-ink-soft">{shop.about}</p>}
        </div>
        {photoCount > 0 && (
          <a
            href={`/s/${shop.slug}/photo/1`}
            target="_blank"
            rel="noopener"
            className="group flex shrink-0 flex-col items-center gap-1.5 rounded-sm"
          >
            <Image
              src={`/s/${shop.slug}/photo/1`}
              alt={`The price list ${shop.name} was made from`}
              width={88}
              height={112}
              unoptimized
              className="h-28 w-22 -rotate-2 rounded-sm border border-line-strong object-cover shadow-md transition-transform group-hover:rotate-0"
            />
            <span className="type-meta text-ink-muted underline-offset-2 group-hover:underline">The original</span>
          </a>
        )}
      </div>
      {shop.status === 'paused' && (
        <p role="status" className="flex items-start gap-2.5 rounded-md bg-warn-soft px-4 py-3 font-semibold text-warn">
          <Icon icon={PauseCircle} className="mt-0.5" />
          <span>
            Not taking orders right now.{' '}
            <span className="font-normal">You can still read the menu and ask the assistant about it.</span>
          </span>
        </p>
      )}
      <HowToGetIt shop={shop} />
    </div>
  );
}

export default async function ShopPage({ params, searchParams }: PageProps<'/s/[slug]'>) {
  const { slug } = await params;
  const { assistant } = await searchParams;
  const shop = loadShop(slug);
  const items = itemsRepo.listWithVariants(getDb(), shop.id, { status: ['live', 'in_person'] });
  const doorUrl = `${getConfig().appUrl}/s/${shop.slug}/mcp`;

  return (
    <ShopAssistant
      slug={shop.slug}
      shopName={shop.name}
      starters={starterPrompts(shop, items)}
      initiallyOpen={assistant === '1'}
      intro={<Intro shop={shop} photoCount={shop.menuPhotoPaths.length} />}
      menu={<Menu sections={menuSections(items)} />}
      door={<AgentDoor slug={shop.slug} shopName={shop.name} url={doorUrl} />}
    />
  );
}
