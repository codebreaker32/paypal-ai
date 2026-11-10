import { cn } from '@/lib/utils';

/**
 * Shelfie's chat helper: a round-headed little bot with blush cheeks on a pomegranate disc. Drawn for Shelfie, so it is
 * never a stock icon or an AI company's mark. Decorative unless given a `label`.
 */
export function BotMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" fill="var(--color-accent)" />
      {/* antenna */}
      <path d="M24 15.5V10" stroke="var(--color-surface)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="8.5" r="3" fill="var(--color-blush-ring)" />
      {/* ears */}
      <rect x="8.5" y="21.5" width="4" height="9" rx="2" fill="var(--color-surface)" />
      <rect x="35.5" y="21.5" width="4" height="9" rx="2" fill="var(--color-surface)" />
      {/* head */}
      <rect x="11.5" y="15" width="25" height="22" rx="10" fill="var(--color-surface)" />
      {/* eyes */}
      <ellipse cx="19" cy="24.5" rx="2.2" ry="2.8" fill="var(--color-ink)" />
      <ellipse cx="29" cy="24.5" rx="2.2" ry="2.8" fill="var(--color-ink)" />
      <circle cx="19.8" cy="23.4" r="0.8" fill="var(--color-surface)" />
      <circle cx="29.8" cy="23.4" r="0.8" fill="var(--color-surface)" />
      {/* cheeks */}
      <ellipse cx="15.6" cy="29.6" rx="2.3" ry="1.6" fill="var(--color-blush-ring)" />
      <ellipse cx="32.4" cy="29.6" rx="2.3" ry="1.6" fill="var(--color-blush-ring)" />
      {/* smile */}
      <path d="M20.8 30.2q3.2 2.8 6.4 0" fill="none" stroke="var(--color-ink)" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
