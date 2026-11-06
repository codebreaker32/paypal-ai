import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
/* eslint-disable @next/next/no-img-element -- cover photos are site-relative files of unknown size */
import { AgentDoor } from '@/components/shop/AgentDoor';
import { Menu, menuSections } from '@/components/shop/Menu';
import { ShopAssistant } from '@/components/shop/ShopAssistant';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { starterPrompts } from '@/components/shop/starters';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { jsonLdScript, shopJsonLd } from '@/lib/discovery/jsonld';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { menuPhotoAvatarSrc } from '@/lib/domain/avatar';
import { LISTED_STATUSES } from '@/lib/domain/listed';
import { formatUSD } from '@/lib/domain/money';
import { takesOrders } from '@/lib/orders/pricing';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';

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

const KIND: Record<Shop['kind'], string> = { food: 'Food', goods: 'Goods', services: 'Services' };

/** Pickup and shipping, one compact line each: the label in bold, the details beside it. */
function HowToGetIt({ shop }: { shop: Shop }) {
  const pickup = shop.fulfillment !== 'shipping';
  const shipping = shop.fulfillment !== 'pickup';
  return (
    <dl aria-label="How to get it" className="flex flex-col gap-1.5 text-[0.9375rem]">
      {pickup && (
        <div className="flex gap-2">
          <dt className="w-18 shrink-0 font-bold">Pickup</dt>
          <dd className="text-ink-soft">{shop.pickupNotes || 'Ask the shop when and where to pick up.'}</dd>
        </div>
      )}
      {shipping && (
        <div className="flex gap-2">
          <dt className="w-18 shrink-0 font-bold">Shipping</dt>
          <dd className="text-ink-soft">
            <span className="type-figures font-semibold text-ink">{shop.shippingFeeCents > 0 ? `${formatUSD(shop.shippingFeeCents)} flat` : 'Free'}</span>{' '}
            per order
          </dd>
        </div>
      )}
    </dl>
  );
}

/** The cover: the shop's own photo, else a strip of its item photos (like a store-front window), else nothing. */
function Cover({ shop, items }: { shop: Shop; items: ItemWithVariants[] }) {
  const strip = items.filter((i) => i.photoUrl).slice(0, 4);
  if (!shop.coverUrl && strip.length < 2) return null;
  return (
    <div className="mx-auto w-full max-w-page sm:px-gutter sm:pt-6">
      <div className="relative h-44 overflow-hidden bg-surface-sunken sm:h-64 sm:rounded-(--cover-radius) lg:h-80">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full grid-flow-col auto-cols-fr gap-1">
            {strip.map((i) => (
              <img key={i.id} src={i.photoUrl!} alt="" className="size-full object-cover" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Intro({ shop, items, photoCount }: { shop: Shop; items: ItemWithVariants[]; photoCount: number }) {
  const hasCover = !!shop.coverUrl || items.filter((i) => i.photoUrl).length >= 2;
  const avatar = { logoUrl: shop.logoUrl, coverUrl: shop.coverUrl, kind: shop.kind, menuPhotoSrc: menuPhotoAvatarSrc(shop, 'public') };
  return (
    <div className="flex flex-col gap-5">
      {/* With a cover, the shop's picture sits over its bottom edge, so a shop with photos keeps its identity too. Its own
          stacking layer (z-10) keeps it above the cover and above the menu's first card at every width. */}
      {hasCover && <ShopAvatar shop={avatar} items={items} size="xl" className="relative z-10 -mt-16 -mb-1 shadow-(--card-shadow) ring-4 ring-surface sm:-mt-20" />}
      <div className="flex items-start gap-4">
        {!hasCover && <ShopAvatar shop={avatar} items={items} size="lg" />}
        <div className="min-w-0 flex-1">
          <h1 className="type-hero [overflow-wrap:anywhere]">{shop.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.9375rem] text-ink-muted">
            <span>{KIND[shop.kind]}</span>
            <span aria-hidden="true">·</span>
            <span>{shop.fulfillment === 'both' ? 'Pickup or shipping' : shop.fulfillment === 'pickup' ? 'Pickup' : 'Shipping'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-ink">Paid with PayPal</span>
          </p>
        </div>
      </div>
      {shop.about && <p className="max-w-measure type-lead text-ink-soft">{shop.about}</p>}
      {/* Whenever the agent door would refuse an order (takesOrders): paused, or live with nowhere to be paid. */}
      {!takesOrders(shop) && (
        <p role="status" className="rounded-(--card-radius) bg-warn-soft px-4 py-3 font-semibold text-warn">
          {shop.status === 'paused' ? 'Not taking orders right now.' : 'Not taking orders online yet.'}{' '}
          <span className="font-normal">You can still read the menu and ask the assistant about it.</span>
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HowToGetIt shop={shop} />
        {photoCount > 0 && (
          <a
            href={`/s/${shop.slug}/photo/1`}
            target="_blank"
            rel="noopener"
            className="group inline-flex min-h-tap shrink-0 items-center gap-3 self-start rounded-(--card-radius) pr-2 font-semibold no-underline"
          >
            <Image
              src={`/s/${shop.slug}/photo/1`}
              alt={`The price list ${shop.name} was made from`}
              width={88}
              height={88}
              unoptimized
              className="size-12 rounded-(--thumb-radius) object-cover shadow-(--card-shadow)"
            />
            <span className="text-sm text-ink-soft group-hover:text-ink group-hover:underline">Original price list</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default async function ShopPage({ params, searchParams }: PageProps<'/s/[slug]'>) {
  const { slug } = await params;
  const { assistant } = await searchParams;
  const shop = loadShop(slug);
  const items = itemsRepo.listWithVariants(getDb(), shop.id, { status: [...LISTED_STATUSES] });
  const shopUrl = `${getConfig().appUrl}/s/${shop.slug}`;
  const doorUrl = `${shopUrl}/mcp`;
  // Live, and it can be paid: otherwise the door refuses every order, so nothing on the page offers one.
  const ordersOpen = takesOrders(shop);

  return (
    <>
      {/* For agents that read the page itself (spec §10a): React hoists the link into <head>; the JSON-LD is the menu
          as schema.org offers. Both name the agent door only while the shop takes orders (live, and it can be paid),
          like /agents.txt and /llms.txt. */}
      {ordersOpen && <link rel="alternate" type="application/json" title="Agent door (MCP)" href={doorUrl} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(shopJsonLd(shop, items, { shopUrl, doorUrl })) }}
      />
      <ShopAssistant
        slug={shop.slug}
        shopName={shop.name}
        starters={starterPrompts(shop, items, { takesOrders: ordersOpen })}
        initiallyOpen={assistant === '1'}
        cover={<Cover shop={shop} items={items} />}
        intro={<Intro shop={shop} items={items} photoCount={shop.menuPhotoPaths.length} />}
        menu={<Menu sections={menuSections(items)} kind={shop.kind} />}
        door={<AgentDoor slug={shop.slug} shopName={shop.name} url={doorUrl} takesOrders={ordersOpen} />}
        takesOrders={ordersOpen}
      />
    </>
  );
}
