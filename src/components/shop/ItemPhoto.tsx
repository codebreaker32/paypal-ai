/* eslint-disable @next/next/no-img-element -- site-relative photos (bundled /demo files and uploads) of unknown size; a plain lazy img keeps them simple */
import { ItemIllustration, tileTone } from '@/components/illustrations/ItemIllustration';
import { cx } from '@/components/ui/cx';
import type { ItemCategory } from '@/lib/domain/category';

export { tileTone };

export interface ItemPhotoProps {
  name: string;
  photoUrl: string | null;
  /** The item's drawing when it has no photo (`itemCategory(item, shop.kind)`). */
  category: ItemCategory;
  /** Index of the item's menu section, for the fallback tint. */
  tone?: number;
  dim?: boolean;
  className?: string;
  /** Load at once rather than lazily: the few thumbnails of one order, which a phone may only reach by scrolling. */
  eager?: boolean;
  /** Decorative copies (the start page mock-up, list thumbnails next to the name) pass an empty alt. */
  decorative?: boolean;
}

/**
 * An item's photo (the seller's own, or a crop they kept from "Snap your counter"), or its designed fallback: a Shelfie
 * drawing of what the item is (a loaf, a croissant, a taco …) on its section's tint, so a menu with no photos still
 * reads as a deliberate, colour-coded grid of pictures rather than grey boxes or letters.
 */
export function ItemPhoto({ name, photoUrl, category, tone = 0, dim, className, decorative, eager }: ItemPhotoProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={decorative ? '' : name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={cx('block object-cover', dim && 'opacity-50 grayscale', className)}
      />
    );
  }
  // The drawing is generic, so it is never the item's picture for a screen reader: the item's name says it.
  if (decorative) return <ItemIllustration category={category} tone={tone} dim={dim} className={className} />;
  return (
    <span role="img" aria-label={name} className={cx('block overflow-hidden', className)}>
      <ItemIllustration category={category} tone={tone} dim={dim} className="size-full" />
    </span>
  );
}
