import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Icon } from './icon';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';

/** Props a Field hands to its control so label, hint and error are wired for screen readers. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** A stable id for the control (a form's password fields need it); generated otherwise. */
  id?: string;
  hint?: ReactNode;
  /** The hint changes as they type, so announce it politely. */
  liveHint?: boolean;
  /** Say what went wrong and how to fix it: "Enter a price, like 4.50". */
  error?: ReactNode;
  /** Marks the label with an asterisk (the control gets `required`, so screen readers say "required"). */
  required?: boolean;
  /** Says "(optional)" after the label, for a field a person might think they must fill. */
  optional?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, optional hint and inline error around one control. */
export function Field({ label, id: givenId, hint, liveHint, error, required, optional, hideLabel, className, children }: FieldProps) {
  const generatedId = useId();
  const id = givenId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div data-slot="field" className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-accent-ink font-semibold">
            {' '}*
          </span>
        )}
        {!required && optional && <span className="text-ink-muted font-normal"> (optional)</span>}
      </Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} aria-live={liveHint ? 'polite' : undefined} className="type-meta text-ink-muted">
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
    <p id={id} role="alert" className={cn('flex items-start gap-1.5 text-sm text-error font-medium', className)}>
      <Icon icon={CircleAlert} size="sm" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

/** The text input (shadcn `Input`) under its older name. */
export const TextInput = Input;

/** The multi-line input (shadcn `Textarea`) under its older name. */
export const TextArea = Textarea;
