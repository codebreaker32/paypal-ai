import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Shared look of every text control: 48 px, 16 px text (no zoom on iOS), `control` border, error border when aria-invalid. */
export const controlClasses =
  'w-full min-h-(--field-h) rounded-(--field-radius) border border-(--field-border) bg-(--field-bg) px-3.5 ' +
  'text-base text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] ' +
  'hover:border-ink-soft focus-visible:border-(--field-border-focus) ' +
  'aria-invalid:border-error disabled:bg-surface-sunken disabled:text-ink-muted';

/** shadcn's input with Shelfie's control styling. Inside a form, wrap it in `Field` for the label and error wiring. */
export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(controlClasses, className)} {...rest} />;
}
