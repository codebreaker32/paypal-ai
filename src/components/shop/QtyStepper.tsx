'use client';

import { Minus, Plus } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';

const BUTTON = 'press-icon flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40';

export interface QtyStepperProps {
  value: number;
  /** 1 in the item sheet; 0 in the cart, where the last press takes the line out. */
  min: number;
  max: number;
  /** Names the group, e.g. the visible `How many`. */
  labelledBy?: string;
  label?: string;
  lessLabel: string;
  moreLabel: string;
  disabled?: boolean;
  onChange: (next: number) => void;
  className?: string;
}

/** `− n +` with a 44 px press on each side. The number is plain text; the announcement comes from the cart's status line. */
export function QtyStepper({ value, min, max, labelledBy, label, lessLabel, moreLabel, disabled, onChange, className }: QtyStepperProps) {
  return (
    <div role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} className={cx('inline-flex items-center rounded-full bg-surface-sunken', className)}>
      <button type="button" aria-label={lessLabel} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className={BUTTON}>
        <Icon icon={Minus} size="sm" />
      </button>
      <span className="w-7 text-center font-bold type-figures">{value}</span>
      <button type="button" aria-label={moreLabel} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className={BUTTON}>
        <Icon icon={Plus} size="sm" />
      </button>
    </div>
  );
}
