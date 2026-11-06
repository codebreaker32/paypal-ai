/* eslint-disable @next/next/no-img-element -- site-relative logos, covers and menu photos of unknown size */
import { ItemIllustration } from '@/components/illustrations/ItemIllustration';
import { cx } from '@/components/ui/cx';
import { shopAvatar } from '@/lib/domain/avatar';
import type { ItemCategory } from '@/lib/domain/category';
import type { Shop } from '@/lib/domain/types';

export interface ShopAvatarProps {
  shop: Pick<Shop, 'logoUrl' | 'coverUrl' | 'slug' | 'menuPhotoPaths' | 'kind'>;
  items: { category: ItemCategory | null; name: string; section: string | null; description: string | null }[];
  /** sm: a list row (start page); md: the dashboard header; lg: beside the shop's name; xl: over the shop's cover. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Where the first menu photo is served from: owner pages pass the owner route, which also serves drafts. */
  menuPhotoSrc?: string;
  className?: string;
}

const SIZE = {
  sm: 'size-10 rounded-(--thumb-radius)',
  md: 'size-14 rounded-(--photo-radius)',
  lg: 'size-16 sm:size-20 rounded-(--photo-radius)',
  xl: 'size-20 sm:size-24 rounded-(--photo-radius)',
} as const;

/**
 * The shop's picture in a rounded square: its logo, else its cover or menu photo cropped square, else a Shelfie drawing
 * of what it sells most. Never letters (`shopAvatar`). Decorative: the shop's name always sits beside it.
 */
export function ShopAvatar({ shop, items, size = 'md', menuPhotoSrc, className }: ShopAvatarProps) {
  const source = shopAvatar(shop, items);
  const box = cx('block shrink-0 overflow-hidden', SIZE[size], className);
  if (source.kind === 'illustration') {
    return <ItemIllustration category={source.category} tone={0} className={box} />;
  }
  const src = source.kind === 'menu' && menuPhotoSrc ? menuPhotoSrc : source.src;
  return <img src={src} alt="" aria-hidden="true" data-avatar={source.kind} className={cx(box, 'bg-surface-sunken object-cover')} />;
}
