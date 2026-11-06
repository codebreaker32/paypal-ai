import { cx } from '@/components/ui/cx';

export interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

const MARK = { sm: 'size-6', md: 'size-7' } as const;
const WORD = { sm: 'text-lg', md: 'text-[1.375rem]' } as const;

/**
 * The Shelfie mark: a camera viewfinder framing a scored loaf ("snap your shelf"), white on a pomegranate tile.
 * The same drawing is public/brand/mark.svg and src/app/icon.svg, and without the tile public/brand/glyph.svg (the app
 * icons, scripts/make-icons.ts).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cx('shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M6 11V6h5M21 6h5v5M6 21v5h5M21 26h5v-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21.5v-3.2a6 5.3 0 0 1 12 0v3.2z" fill="#fff" />
      <path d="M13.6 14.9l1.6 2.2M17.1 14.4l1.6 2.2" className="stroke-accent" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Shelfie wordmark: the mark beside the name, lowercase, in the UI face at its heaviest. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-ink', className)}>
      <LogoMark className={MARK[size]} />
      <span className={cx('font-extrabold tracking-display leading-none', WORD[size])}>shelfie</span>
    </span>
  );
}
