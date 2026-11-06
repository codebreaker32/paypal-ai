import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'error' | 'info' | 'note';

// shadcn's badge pattern (cva + data-slot) with Shelfie's soft pills.
export const badgeVariants = cva(
  'inline-flex min-h-(--badge-h) items-center gap-1.5 rounded-(--badge-radius) px-2.5 type-meta font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-ink-soft',
        accent: 'bg-accent-soft text-accent-ink',
        ok: 'bg-ok-soft text-ok',
        warn: 'bg-warn-soft text-warn',
        danger: 'bg-error-soft text-error',
        error: 'bg-error-soft text-error',
        info: 'bg-info-soft text-info',
        note: 'bg-note-soft text-note-ink',
      } satisfies Record<BadgeTone, string>,
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps {
  tone?: BadgeTone;
  /** Pair status colour with an icon so meaning never rests on colour alone. */
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

/** A short status label: "Paid", "Needs you", "Sold out today". */
export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)}>
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </span>
  );
}
