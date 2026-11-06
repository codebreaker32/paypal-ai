import { cx } from '@/components/ui/cx';
import type { ItemCategory } from '@/lib/domain/category';
import { drawingId } from '@/lib/domain/drawing';

/** Section tints behind a drawing. A shop's sections cycle through them in menu order. */
const TILES = ['bg-tile-rose', 'bg-tile-sage', 'bg-tile-sky', 'bg-tile-lilac'] as const;

export const tileTone = (sectionIndex: number) => TILES[((sectionIndex % TILES.length) + TILES.length) % TILES.length];

/**
 * The drawings live once in public/illustrations.svg (one <symbol> per category, plus variants within a category that
 * the item's name picks, `drawingId`; filled from the --ill-* tokens);
 * every tile points at one with <use>, so a menu of 30 photo-less items adds 30 short <use> tags to the page, not 30
 * copies of the paths, and the browser downloads and caches the sheet once.
 */
export const ILLUSTRATION_SHEET = '/illustrations.svg';

export interface ItemIllustrationProps {
  category: ItemCategory;
  /** The item's name, which picks a variant within its category (a bun, a tart, a pain au chocolat for `pastry`). */
  name?: string | null;
  /** Section index for the tint; omit for no tile (the drawing alone, on whatever is behind it). */
  tone?: number;
  dim?: boolean;
  className?: string;
}

/** A Shelfie drawing of the item's kind (a loaf, a croissant, a taco …) on its section's tint. Always decorative. */
export function ItemIllustration({ category, name, tone, dim, className }: ItemIllustrationProps) {
  const id = drawingId(category, name);
  return (
    <span
      aria-hidden="true"
      data-illustration={category}
      data-drawing={id}
      className={cx(
        'relative flex items-center justify-center overflow-hidden select-none',
        tone === undefined ? null : dim ? 'bg-surface-sunken' : tileTone(tone),
        className,
      )}
    >
      <svg viewBox="0 0 96 72" focusable="false" className={cx('block h-full max-h-full w-full', dim && 'opacity-50 grayscale')}>
        <use href={`${ILLUSTRATION_SHEET}#${id}`} />
      </svg>
    </span>
  );
}
