/* eslint-disable @next/next/no-img-element -- site-relative logos, covers and menu photos of unknown size */
import { ItemIllustration } from '@/components/illustrations/ItemIllustration';
import { cx } from '@/components/ui/cx';
import { responsiveImage } from '@/lib/images/responsive';
import { shopAvatar, type AvatarShop } from '@/lib/domain/avatar';
import type { ItemCategory } from '@/lib/domain/category';

export interface ShopAvatarProps {
  /** Its logo, cover, kind and where its first menu photo is shown from (`menuPhotoAvatarSrc`). */
  shop: AvatarShop;
  /** The items its shop page lists (`listedItems`, `itemsRepo.avatarItems`). */
  items: { category: ItemCategory | null; name: string; section: string | null; description: string | null }[];
  /** sm: a list row (start page); md: the dashboard header; lg: beside the shop's name; xl: over the shop's cover. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  sm: 'size-10 rounded-(--thumb-radius)',
  md: 'size-14 rounded-(--photo-radius)',
  lg: 'size-16 sm:size-20 rounded-(--photo-radius)',
  xl: 'size-20 sm:size-24 rounded-(--photo-radius)',
} as const;

/** The widest each size is drawn (CSS px), for the srcset of a photo avatar. */
const DRAWN_PX = { sm: 40, md: 56, lg: 80, xl: 96 } as const;

/**
 * The shop's picture in a rounded square: its logo, else its cover or menu photo cropped square, else a Shelfie drawing
 * of what it sells most. Never letters (`shopAvatar`). Decorative: the shop's name always sits beside it.
 */
export function ShopAvatar({ shop, items, size = 'md', className }: ShopAvatarProps) {
  const source = shopAvatar(shop, items);
  const box = cx('block shrink-0 overflow-hidden', SIZE[size], className);
  if (source.kind === 'illustration') {
    return <ItemIllustration category={source.category} tone={0} className={box} />;
  }
  if (source.kind === 'cover') {
    // The badge sits over the cover itself, so it shows a detail of it (the centre, about 1.8x), not a smaller copy.
    return (
      <span aria-hidden="true" data-avatar="cover" className={cx(box, 'bg-surface-sunken overflow-hidden')}>
        <img src={source.src} {...responsiveImage(source.src, `${Math.round(DRAWN_PX[size] * 1.8)}px`)} alt="" className="block size-full scale-[1.8] object-cover object-center" />
      </span>
    );
  }
  return (
    <img
      src={source.src}
      {...responsiveImage(source.src, `${DRAWN_PX[size]}px`)}
      alt=""
      aria-hidden="true"
      data-avatar={source.kind}
      className={cx(box, 'bg-surface-sunken object-cover')}
    />
  );
}
