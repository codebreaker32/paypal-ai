import { cx } from '@/components/ui/cx';

export interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

const MARK = { sm: 'size-6', md: 'size-7' } as const;
const GLYPH = { sm: 'size-4', md: 'size-[1.125rem]' } as const;
const WORD = { sm: 'text-lg', md: 'text-xl' } as const;

/** Shelfie wordmark: a price tag stamped on a cash-green tile, beside the name in the display face. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <span className={cx('inline-flex items-center gap-2.5 text-ink', className)}>
      <span className={cx(MARK[size], 'inline-flex shrink-0 items-center justify-center rounded-sm bg-accent')}>
        {/* Tag outline follows lucide's "tag" glyph (ISC licence), filled as a solid mark. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={GLYPH[size]}>
          <path
            className="fill-on-accent"
            d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
          />
          <circle className="fill-accent" cx="7.5" cy="7.5" r="2" />
        </svg>
      </span>
      <span className={cx('font-display font-soft font-bold tracking-display leading-none', WORD[size])}>Shelfie</span>
    </span>
  );
}
