/* eslint-disable @next/next/no-img-element -- site-relative photos (bundled /demo files and uploads) of unknown size; a plain lazy img keeps them simple */
import { cx } from '@/components/ui/cx';

/** Section tints for items without a photo. A shop's sections cycle through them in menu order. */
const TILES = [
  'bg-tile-rose text-tile-rose-ink',
  'bg-tile-sage text-tile-sage-ink',
  'bg-tile-sky text-tile-sky-ink',
  'bg-tile-lilac text-tile-lilac-ink',
] as const;

export const tileTone = (sectionIndex: number) => TILES[((sectionIndex % TILES.length) + TILES.length) % TILES.length];

/** "Country sourdough loaf" -> "Cs": the first letter of the first two words that start with a letter. */
export function monogram(name: string): string {
  const words = name.split(/[\s–—-]+/).filter((w) => /^\p{L}/u.test(w));
  const first = words[0]?.[0]?.toUpperCase() ?? name.trim()[0]?.toUpperCase() ?? '?';
  const second = words[1]?.[0]?.toLowerCase() ?? '';
  return first + second;
}

export interface ItemPhotoProps {
  name: string;
  photoUrl: string | null;
  /** Index of the item's menu section, for the fallback tint. */
  tone?: number;
  /** Fallback lettering size: thumbnails use `sm`. */
  size?: 'sm' | 'md' | 'lg';
  dim?: boolean;
  className?: string;
  /** Decorative copies (the start page mock-up, list thumbnails next to the name) pass an empty alt. */
  decorative?: boolean;
}

const LETTER = { sm: 'text-base', md: 'text-[2.5rem]', lg: 'text-[3.5rem]' } as const;

/**
 * An item's photo, or its designed fallback: the item's monogram set large on its section's tint, with a soft shelf
 * line under it, so a menu with no photos still reads as a deliberate, colour-coded grid rather than grey boxes.
 */
export function ItemPhoto({ name, photoUrl, tone = 0, size = 'md', dim, className, decorative }: ItemPhotoProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={decorative ? '' : name}
        loading="lazy"
        decoding="async"
        className={cx('block object-cover', dim && 'opacity-50 grayscale', className)}
      />
    );
  }
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cx('relative flex items-center justify-center overflow-hidden select-none', tileTone(tone), dim && 'opacity-60', className)}
    >
      <span className={cx('leading-none font-extrabold tracking-display', LETTER[size])}>{monogram(name)}</span>
      {size !== 'sm' && <span aria-hidden="true" className="absolute inset-x-[18%] bottom-[16%] h-[3px] rounded-full bg-current opacity-25" />}
    </span>
  );
}
