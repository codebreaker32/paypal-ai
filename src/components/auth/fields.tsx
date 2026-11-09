'use client';

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

/**
 * For a controlled input on a server-rendered form: what was typed or autofilled before React arrived is still in the
 * DOM at mount, and React's next update would write the empty state over it. Attach the returned ref to the input.
 */
export function useKeepTypedValue(value: string, onChange: (value: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const adopt = useEffectEvent(() => {
    const typed = input.current?.value;
    if (typed && typed !== value) onChange(typed);
  });
  useEffect(() => adopt(), []);
  return input;
}

/** The login email of a form: the same keyboard and autofill everywhere, its own id and name per form. */
export function EmailField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
}) {
  const input = useKeepTypedValue(value, onChange);
  return (
    <Field label="Email" id={id} error={error}>
      {(control) => (
        <Input
          {...control}
          ref={input}
          name={id}
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export interface PasswordFieldProps {
  /** Also the input's name: a form's fields each have their own, so password managers can tell the forms apart. */
  id: string;
  label: string;
  autoComplete: 'new-password' | 'current-password';
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  liveHint?: boolean;
  error?: ReactNode;
}

/** A password input with a show button. Paste is allowed; the password goes back to hidden when the form submits. */
export function PasswordField({ id, label, autoComplete, value, onChange, hint, liveHint, error }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const input = useKeepTypedValue(value, onChange);

  // A browser only offers to save a password from a real password field, and nothing typed should stay on show.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, [input]);

  return (
    <Field label={label} id={id} hint={hint} liveHint={liveHint} error={error}>
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            ref={input}
            name={id}
            type={shown ? 'text' : 'password'}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-12"
          />
          <button
            type="button"
            aria-label={shown ? 'Hide password' : 'Show password (it will be visible on screen)'}
            onClick={() => setShown((s) => !s)}
            className="press-icon absolute top-0.5 right-0.5 flex size-tap items-center justify-center rounded-md text-ink-soft hover:text-ink"
          >
            <Icon icon={shown ? EyeOff : Eye} />
          </button>
        </div>
      )}
    </Field>
  );
}
