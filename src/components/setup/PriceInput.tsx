'use client';

import type { ComponentProps } from 'react';
import { Field, TextInput } from '@/components/ui/Field';
import { cx } from '@/components/ui/cx';

export const PRICE_ERROR = 'Enter a price like 4.50 (up to $500)';

/**
 * A dollar amount on the phone's decimal keypad. The parent keeps the text and turns it into cents
 * with parsePriceInput(); show `error` only once the person has left the field.
 */
export function PriceInput({
  label,
  value,
  onValueChange,
  error,
  hint,
  hideLabel,
  className,
  ...rest
}: {
  label: string;
  value: string;
  onValueChange: (text: string) => void;
  error?: string | null;
  hint?: string;
  hideLabel?: boolean;
  className?: string;
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'className'>) {
  return (
    <Field label={label} hint={hint} error={error ?? undefined} hideLabel={hideLabel} className={className}>
      {(control) => (
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted">
            $
          </span>
          <TextInput
            {...control}
            {...rest}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0.00"
            value={value}
            onChange={(e) => onValueChange(e.currentTarget.value)}
            className={cx('pl-7 type-price')}
          />
        </div>
      )}
    </Field>
  );
}
