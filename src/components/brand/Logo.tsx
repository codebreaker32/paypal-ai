import { cx } from '@/components/ui/cx';

export interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

const MARK = { sm: 'size-6', md: 'size-7' } as const;
const WORD = { sm: 'text-xl', md: 'text-2xl' } as const;

/** Shelfie wordmark: a hanging price tag beside the name set in the display face. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-ink', className)}>
      {/* Tag outline follows lucide's "tag" glyph (ISC licence), filled as a solid mark. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cx(MARK[size], 'shrink-0')}>
        <path
          className="fill-accent"
          d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
        />
        <circle className="fill-surface" cx="7.5" cy="7.5" r="2" />
      </svg>
      <span className={cx('font-display font-soft font-semibold tracking-display leading-none', WORD[size])}>
        Shelfie
      </span>
    </span>
  );
}
