import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-soft border-line-strong',
  accent: 'bg-accent-soft text-accent-ink border-accent',
  ok: 'bg-ok-soft text-ok border-current',
  warn: 'bg-warn-soft text-warn border-current',
  danger: 'bg-danger-soft text-danger border-current',
  info: 'bg-info-soft text-info border-current',
};

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
    <span
      className={cx(
        'inline-flex min-h-(--badge-h) items-center gap-1.5 rounded-(--badge-radius) border px-2 type-meta font-semibold whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </span>
  );
}
