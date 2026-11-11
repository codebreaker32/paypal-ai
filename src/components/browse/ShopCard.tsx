/* eslint-disable @next/next/no-img-element -- site-relative covers and item photos of unknown size */
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ItemIllustration } from '@/components/illustrations/ItemIllustration';
import { Pressable } from '@/components/motion';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import type { BrowseShop } from '@/lib/db/repos/browse';
import { shopAvatar } from '@/lib/domain/avatar';
import { kindDefault } from '@/lib/domain/category';
import { shopCategoryLabel, type ShopCategory } from '@/lib/domain/shop-category';
import { responsiveImage } from '@/lib/images/responsive';

/** A card is a third of the site's width at most (1440 px wide, gutters aside). */
const COVER_SIZES = '(min-width: 1024px) 440px, (min-width: 640px) 50vw, 100vw';
const STRIP_SIZES = '(min-width: 1024px) 150px, (min-width: 640px) 17vw, 34vw';

/** The drawing's tint when a shop has no photos: one per category, so neighbouring cards differ. */
const TONE: Record<ShopCategory, number> = { food: 0, drinks: 2, flowers: 1, gifts: 1, repairs: 3 };

/** Whether the card's top is a photo (so the avatar sits over its edge) or the drawing (which already says it all). */
export const hasPhotoCover = (shop: BrowseShop): boolean => !!shop.coverUrl || shop.itemPhotos.length > 0;

const KIND = { food: 'Food', goods: 'Goods', services: 'Services' } as const;
const GET_IT = { pickup: 'Pickup', shipping: 'Ships', both: 'Pickup or shipping' } as const;

/** The top of the card: the seller's cover, else a strip of their item photos, else the drawing of what they sell. */
function CardCover({ shop }: { shop: BrowseShop }) {
  if (shop.coverUrl) {
    return <img src={shop.coverUrl} {...responsiveImage(shop.coverUrl, COVER_SIZES)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />;
  }
  if (shop.itemPhotos.length) {
    return (
      <div className="grid size-full grid-flow-col auto-cols-fr gap-0.5">
        {shop.itemPhotos.map((src) => (
          <img key={src} src={src} {...responsiveImage(src, STRIP_SIZES)} alt="" loading="lazy" className="size-full object-cover" />
        ))}
      </div>
    );
  }
  const source = shopAvatar(shop.avatar.shop, shop.avatar.items);
  const category = source.kind === 'illustration' ? source.category : kindDefault(shop.kind);
  return <ItemIllustration category={category} tone={TONE[shop.category ?? 'food']} className="size-full px-[30%] py-6" />;
}

/**
 * One shop on /browse: its picture, name, what it is and one line, and the way in. The "Open shop" link covers the
 * whole card (its ::after), so the card is one target and one tab stop, named after the shop.
 */
export function ShopCard({ shop }: { shop: BrowseShop }) {
  const what = shop.category ? shopCategoryLabel(shop.category) : KIND[shop.kind];
  return (
    <Pressable as="article" className="group flex h-full flex-col rounded-2xl bg-surface shadow-(--card-shadow) ring-1 ring-line has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ink">
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-surface-sunken">
        <CardCover shop={shop} />
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        {hasPhotoCover(shop) && <ShopAvatar shop={shop.avatar.shop} items={shop.avatar.items} size="md" className="-mt-7 shadow-(--card-shadow) ring-4 ring-surface" />}
        <h2 className="mt-4 text-xl leading-tight font-bold tracking-tight text-ink [overflow-wrap:anywhere]">{shop.name}</h2>
        <p className="mt-1 text-[0.9375rem] text-ink-muted">
          {what}
          <span aria-hidden="true" className="px-1.5">
            ·
          </span>
          {GET_IT[shop.fulfillment]}
        </p>
        {shop.line && <p className="mt-3 line-clamp-2 type-body text-ink-soft">{shop.line}</p>}
        <div className="mt-auto pt-5">
          <Link
            href={`/s/${shop.slug}`}
            aria-label={`Open shop: ${shop.name}`}
            data-stretched-link
            className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-accent-ink outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4"
          >
            Open shop
            <ArrowRight aria-hidden="true" className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Pressable>
  );
}
