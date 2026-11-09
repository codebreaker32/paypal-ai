import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
/* eslint-disable @next/next/no-img-element -- cover photos are site-relative files of unknown size */
import { AgentDoor } from '@/components/shop/AgentDoor';
import { shopCartData } from '@/components/shop/cart-menu';
import { Menu, menuSections } from '@/components/shop/Menu';
import { HeroOrderCta } from '@/components/shop/OrderCta';
import { ShopAssistant } from '@/components/shop/ShopAssistant';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { starterPrompts } from '@/components/shop/starters';
import { cx } from '@/components/ui/cx';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { jsonLdScript, shopJsonLd } from '@/lib/discovery/jsonld';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { menuPhotoAvatarSrc } from '@/lib/domain/avatar';
import { LISTED_STATUSES } from '@/lib/domain/listed';
import { formatUSD } from '@/lib/domain/money';
import { takesOrders } from '@/lib/orders/pricing';
import { responsiveImage } from '@/lib/images/responsive';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';

/** Android shrinks the page for the keyboard, so the assistant's box stays above it. */
export const viewport: Viewport = { interactiveWidget: 'resizes-content' };

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

/** A meta item after the first: its `·` hangs in the gap before it, so a line break hides the dot past the row's clipped edge. */
function MetaItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('relative', className)}>
      <span aria-hidden="true" className="absolute -left-3">
        ·
      </span>
      {children}
    </span>
  );
}

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

/** The cover spans the page (at most the 76rem container); a strip photo is a quarter of it. */
const COVER_SIZES = '(min-width: 1216px) 1216px, 100vw';
const STRIP_SIZES = '(min-width: 1216px) 304px, 25vw';

/** The cover: the shop's own photo, else a strip of its item photos (like a store-front window), else nothing. */
function Cover({ shop, items }: { shop: Shop; items: ItemWithVariants[] }) {
  const strip = items.filter((i) => i.photoUrl).slice(0, 4);
  if (!shop.coverUrl && strip.length < 2) return null;
  return (
    <div data-page-frame="" className="mx-auto w-full max-w-page sm:px-gutter sm:pt-6 lg:pt-4">
      <div className="relative h-32 overflow-hidden bg-surface-sunken sm:h-44 sm:rounded-(--cover-radius) lg:h-60">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} {...responsiveImage(shop.coverUrl, COVER_SIZES)} alt="" fetchPriority="high" className="size-full object-cover" />
        ) : (
          <div className="grid size-full grid-flow-col auto-cols-fr gap-1">
            {strip.map((i) => (
              <img key={i.id} src={i.photoUrl!} {...responsiveImage(i.photoUrl!, STRIP_SIZES)} alt="" fetchPriority="high" className="size-full object-cover" />
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
  // Under 640 px the price list link moves up beside the avatar; from 640 px it is at the right of the pickup lines.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 sm:gap-y-5 @[56rem]/shop:grid-cols-[minmax(0,1fr)_auto_auto] @[56rem]/shop:gap-x-8">
      {/* With a cover, the shop's picture sits over its bottom edge, so a shop with photos keeps its identity too. Its own
          stacking layer (z-10) keeps it above the cover and above the menu's first card at every width. */}
      {hasCover && <ShopAvatar shop={avatar} items={items} size="xl" className="relative z-10 col-start-1 -mt-16 shadow-(--card-shadow) ring-4 ring-surface sm:-mt-20 sm:-mb-1" />}
      {/* The name row: from 1024 px the order button sits at its right end, bottom-aligned with the meta line. */}
      <div className={cx('col-span-2 flex items-start gap-4 lg:items-end @[56rem]/shop:col-span-3', !hasCover && photoCount > 0 && 'max-sm:col-span-1')}>
        {!hasCover && <ShopAvatar shop={avatar} items={items} size="lg" className="lg:self-start" />}
        <div className="min-w-0 flex-1">
          <h1 className="type-display [overflow-wrap:anywhere]">{shop.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-5 overflow-hidden text-[0.9375rem] text-ink-muted">
            <span>{KIND[shop.kind]}</span>
            <MetaItem>{shop.fulfillment === 'both' ? 'Pickup or shipping' : shop.fulfillment === 'pickup' ? 'Pickup' : 'Shipping'}</MetaItem>
            <MetaItem className="font-semibold text-ink">Paid with PayPal</MetaItem>
          </p>
        </div>
        <HeroOrderCta />
      </div>
      {/* Whenever the agent door would refuse an order (takesOrders): paused, or live with nowhere to be paid. */}
      {!takesOrders(shop) && (
        <p role="status" className="col-span-2 @[56rem]/shop:col-span-3 rounded-(--card-radius) bg-warn-soft px-4 py-3 font-semibold text-warn">
          {shop.status === 'paused' ? 'Not taking orders right now.' : 'Not taking orders online yet.'}{' '}
          <span className="font-normal">You can still read the menu and ask the assistant about it.</span>
        </p>
      )}
      {shop.about && <p className="col-span-2 max-w-measure type-body text-ink-soft lg:type-lead @[56rem]/shop:col-span-1">{shop.about}</p>}
      <div className={cx('sm:col-span-1', photoCount > 0 ? 'max-sm:col-span-2' : 'col-span-2')}>
        <HowToGetIt shop={shop} />
      </div>
      {photoCount > 0 && (
        <a
          href={`/s/${shop.slug}/photo/1`}
          target="_blank"
          rel="noopener"
          className={cx(
            'group press-text inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-3 self-start rounded-(--card-radius) font-semibold no-underline sm:justify-start sm:self-center sm:pr-2',
            'max-sm:col-start-2 max-sm:row-start-1',
            hasCover && 'max-sm:-mt-5',
          )}
        >
          <Image
            src={`/s/${shop.slug}/photo/1?size=avatar`}
            alt={`The price list ${shop.name} was made from`}
            width={88}
            height={88}
            unoptimized
            className="size-8 rounded-(--thumb-radius) object-cover shadow-(--card-shadow) sm:size-12"
          />
          <span className="text-sm text-ink-soft group-hover:text-ink group-hover:underline max-sm:sr-only">Original price list</span>
        </a>
      )}
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
  const sections = menuSections(items);

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
        menu={<Menu sections={sections} kind={shop.kind} takesOrders={ordersOpen} />}
        cartData={shopCartData(shop, sections, shop.kind, ordersOpen)}
        door={<AgentDoor slug={shop.slug} shopName={shop.name} url={doorUrl} takesOrders={ordersOpen} />}
        takesOrders={ordersOpen}
      />
    </>
  );
}
