'use client';

import { useId, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The visible label; it also names the switch for screen readers. */
  label: ReactNode;
  description?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** Label and switch side by side, centred (for list rows). Default: label block on the left, top-aligned. */
  inline?: boolean;
  className?: string;
}

/** A labelled on/off switch (role="switch") with a 44 px target; the label is clickable too. */
export function Switch({ checked, onChange, label, description, busy, disabled, inline, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cx('flex gap-2', inline ? 'shrink-0 items-center' : 'items-start gap-3', className)}>
      <div className={cx('flex min-w-0 flex-col', inline ? 'text-right' : 'flex-1 pt-2.5')}>
        <label htmlFor={id} className={cx('leading-6', inline ? 'text-sm font-medium text-ink-soft' : 'font-semibold')}>
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="type-meta text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        aria-busy={busy || undefined}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
        className="group inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed"
      >
        <span
          className={cx(
            'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-(--duration-fast)',
            checked ? 'border-ink bg-ink' : 'border-control bg-surface-sunken',
            (disabled || busy) && 'opacity-60',
          )}
        >
          <span
            className={cx(
              'absolute left-0.75 inline-flex size-5 items-center justify-center rounded-full bg-surface-raised shadow-xs',
              'transition-transform duration-(--duration-base) ease-out',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          >
            {busy && <Icon icon={Loader2} size="sm" className="size-3.5 animate-spin text-ink-soft" />}
          </span>
        </span>
      </button>
    </div>
  );
}
