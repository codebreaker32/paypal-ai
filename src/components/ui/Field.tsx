import { useId, type ComponentProps, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Icon } from './Icon';
import { cx } from './cx';

/** Props a Field hands to its control so label, hint and error are wired for screen readers. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Say what went wrong and how to fix it: "Enter a price, like 4.50". */
  error?: ReactNode;
  required?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, optional hint and inline error around one control. */
export function Field({ label, hint, error, required, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cx('type-label text-ink', hideLabel && 'sr-only')}>
        {label}
        {required && <span className="text-ink-muted font-normal"> (required)</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} className="type-meta text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

/** An inline error line. Also usable on its own under a group of controls. */
export function FieldError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" className={cx('flex items-start gap-1.5 text-sm text-danger font-medium', className)}>
      <Icon icon={CircleAlert} size="sm" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

const CONTROL =
  'w-full min-h-(--field-h) rounded-(--field-radius) border border-(--field-border) bg-(--field-bg) px-3.5 ' +
  'text-base text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] ' +
  'hover:border-ink-soft focus-visible:border-(--field-border-focus) ' +
  'aria-invalid:border-danger disabled:bg-surface-sunken disabled:text-ink-muted';

export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx(CONTROL, className)} {...rest} />;
}

export function TextArea({ className, rows = 3, ...rest }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cx(CONTROL, 'py-2.5 leading-6', className)} {...rest} />;
}
