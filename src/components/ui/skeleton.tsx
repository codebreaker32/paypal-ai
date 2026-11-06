import { cn } from '@/lib/utils';

export interface SkeletonProps {
  /** Size and shape come from the caller so the placeholder matches the real layout, e.g. "h-5 w-40". */
  className?: string;
  rounded?: 'sm' | 'md' | 'full';
}

const ROUND = { sm: 'rounded-sm', md: 'rounded-md', full: 'rounded-full' } as const;

/**
 * A loading placeholder shaped like the content it stands in for. Decorative: wrap the loading
 * region in an element with aria-busy="true" and a visually hidden status such as "Loading orders".
 */
export function Skeleton({ className, rounded = 'sm' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-shimmer bg-(--skeleton-base) bg-size-[200%_100%] motion-reduce:animate-none',
        'bg-[linear-gradient(90deg,var(--skeleton-base)_0%,var(--skeleton-shine)_50%,var(--skeleton-base)_100%)] motion-reduce:bg-none',
        ROUND[rounded],
        className,
      )}
    />
  );
}

/** A paragraph-shaped skeleton: full lines with a shorter last line. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </span>
  );
}
