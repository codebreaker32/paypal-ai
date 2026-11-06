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
import { jsonLdScript, shopJsonLd } from '@/lib/discovery/jsonld';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { formatUSD } from '@/lib/domain/money';
import { takesOrders } from '@/lib/orders/pricing';
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
              <span className="type-figures font-semibold text-ink">{shop.shippingFeeCents > 0 ? `${formatUSD(shop.shippingFeeCents)} flat` : 'Free'}</span>{' '}
              per order, to the address you give PayPal.
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
      <div className="flex items-start gap-5 sm:gap-8">
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="type-hero [overflow-wrap:anywhere]">{shop.name}</h1>
          {shop.about && <p className="mt-4 max-w-measure type-lead text-ink-soft">{shop.about}</p>}
        </div>
        {photoCount > 0 && (
          <a
            href={`/s/${shop.slug}/photo/1`}
            target="_blank"
            rel="noopener"
            className="group relative flex shrink-0 flex-col items-center gap-2 rounded-sm pt-2"
          >
            {/* A strip of tape holding the original price list to the board */}
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 z-10 h-5 w-14 -translate-x-1/2 rotate-3 bg-accent/70 shadow-xs"
            />
            <Image
              src={`/s/${shop.slug}/photo/1`}
              alt={`The price list ${shop.name} was made from`}
              width={176}
              height={224}
              unoptimized
              className="h-32 w-26 -rotate-2 border-4 border-surface-raised object-cover shadow-lg transition-transform duration-(--duration-base) group-hover:rotate-0 sm:h-48 sm:w-38"
            />
            <span className="type-meta font-semibold text-ink-soft underline decoration-accent-hover underline-offset-2">
              The original
            </span>
          </a>
        )}
      </div>
      {/* Whenever the agent door would refuse an order (takesOrders): paused, or live with nowhere to be paid. */}
      {!takesOrders(shop) && (
        <p role="status" className="flex items-start gap-2.5 rounded-md bg-warn-soft px-4 py-3 font-semibold text-warn">
          <Icon icon={PauseCircle} className="mt-0.5" />
          <span>
            {shop.status === 'paused' ? 'Not taking orders right now.' : 'Not taking orders online yet.'}{' '}
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
  const shopUrl = `${getConfig().appUrl}/s/${shop.slug}`;
  const doorUrl = `${shopUrl}/mcp`;

  return (
    <>
      {/* For agents that read the page itself (spec §10a): React hoists the link into <head>; the JSON-LD is the menu
          as schema.org offers. Both name the agent door only while the shop takes orders (live, and it can be paid),
          like /agents.txt and /llms.txt. */}
      {takesOrders(shop) && <link rel="alternate" type="application/json" title="Agent door (MCP)" href={doorUrl} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(shopJsonLd(shop, items, { shopUrl, doorUrl })) }}
      />
      <ShopAssistant
        slug={shop.slug}
        shopName={shop.name}
        starters={starterPrompts(shop, items)}
        initiallyOpen={assistant === '1'}
        intro={<Intro shop={shop} photoCount={shop.menuPhotoPaths.length} />}
        menu={<Menu sections={menuSections(items)} />}
        door={<AgentDoor slug={shop.slug} shopName={shop.name} url={doorUrl} takesOrders={takesOrders(shop)} />}
      />
    </>
  );
}
