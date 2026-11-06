import { cx } from '@/components/ui/cx';

export interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

const MARK = { sm: 'size-6', md: 'size-7' } as const;
const WORD = { sm: 'text-lg', md: 'text-[1.375rem]' } as const;

/** The Shelfie mark: a pomegranate tile with a shelf holding two things (a jar and a bun). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cx('shrink-0', className)}>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <rect x="9" y="9" width="6" height="11" rx="2" fill="#fff" />
      <circle cx="20.5" cy="16.5" r="3.5" fill="#fff" />
      <rect x="6.5" y="21.5" width="19" height="2.5" rx="1.25" fill="#fff" />
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
