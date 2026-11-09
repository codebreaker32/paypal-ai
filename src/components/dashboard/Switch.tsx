'use client';

import { useId, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { preventClick } from '@/components/ui/button-status';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { feedback } from '@/lib/feedback';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The visible label; it also names the switch for screen readers. */
  label: ReactNode;
  description?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** The last change failed: shakes once. The caller rolls `checked` back and shows the error. */
  failed?: boolean;
  /** Label and switch side by side, centred (for list rows). Default: label block on the left, top-aligned. */
  inline?: boolean;
  className?: string;
}

/**
 * A labelled on/off switch (role="switch") with a 44 px target; the label is clickable too. While busy or disabled it is
 * `aria-disabled` and ignores clicks, so it keeps focus and full colour. Pressing flexes the thumb toward its travel
 * (`press-switch`); a press on the label flexes it too.
 */
export function Switch({ checked, onChange, label, description, busy, disabled, failed, inline, className }: SwitchProps) {
  const id = useId();
  const unavailable = busy || disabled;
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
        aria-disabled={unavailable || undefined}
        data-nope={failed || undefined}
        onClick={
          unavailable
            ? preventClick
            : () => {
                onChange(!checked);
                feedback('flip');
              }
        }
        className={cx(
          'press-switch group inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full',
          busy ? 'cursor-progress' : disabled && 'cursor-not-allowed',
        )}
      >
        <span
          className={cx(
            'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-(--duration-fast)',
            checked ? 'border-ink bg-ink' : 'border-control bg-surface-sunken',
            !checked && !unavailable && 'group-hover:border-ink-soft',
            failed && 'animate-nope',
          )}
        >
          <span
            data-thumb=""
            className={cx(
              'absolute left-0.75 inline-flex size-5 items-center justify-center rounded-full bg-surface-raised shadow-xs',
              checked ? 'origin-right translate-x-5' : 'origin-left translate-x-0',
            )}
          >
            <Icon
              icon={Loader2}
              size="sm"
              className={cx(
                'size-3.5 text-ink-soft transition-opacity duration-(--duration-fast)',
                busy ? 'animate-spin opacity-100 delay-300' : 'opacity-0',
              )}
            />
          </span>
        </span>
      </button>
    </div>
  );
}
