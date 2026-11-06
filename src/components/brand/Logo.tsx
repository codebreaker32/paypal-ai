import { cx } from '@/components/ui/cx';
import { LOCKUP, MARK, WORDMARK } from './logo-paths';

export interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
  /** Set when the logo stands alone and must name itself; leave it off inside a link that has its own label. */
  label?: string;
}

/** The lockup's art box: the mark's awning top (y -148) and the print's foot (y 18) to the wordmark's last e. */
const LOCKUP_BOX = '10 -152 838 172';
const LOCKUP_H = { sm: 'h-6', md: 'h-7' } as const;

/**
 * The Shelfie mark ("Awning"): a pomegranate scalloped shop awning over an ink instant print, whose deep chin is the
 * counter. Ink is `currentColor` (set `text-surface` to reverse it on dark); the awning is always the accent.
 * The same drawing is public/brand/mark.svg, src/app/icon.svg (dark-aware favicon) and the app icons
 * (scripts/make-icons.ts); the geometry comes from logo-paths.ts. Rules: docs/DESIGN.md, "Logo".
 */
export function LogoMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox={MARK.viewBox}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cx('shrink-0 text-ink', className)}
    >
      <path d={MARK.awning} className="fill-accent" />
      <path d={MARK.print} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** The lockup: the mark beside the drawn lowercase wordmark (paths, never Figtree text). */
export function Logo({ size = 'md', className, label = 'Shelfie' }: LogoProps) {
  return (
    <svg
      viewBox={LOCKUP_BOX}
      role="img"
      aria-label={label}
      focusable="false"
      className={cx('w-auto shrink-0 text-ink', LOCKUP_H[size], className)}
    >
      <g transform={LOCKUP.mark}>
        <path d={MARK.awning} className="fill-accent" />
        <path d={MARK.print} fill="currentColor" fillRule="evenodd" />
      </g>
      <g transform={LOCKUP.word}>
        {WORDMARK.ink.map((d) => (
          <path key={d} d={d} fill="currentColor" />
        ))}
        <path d={WORDMARK.dot} className="fill-accent" />
      </g>
    </svg>
  );
}
