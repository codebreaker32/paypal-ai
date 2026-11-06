'use client';

import { useState, type FormEvent } from 'react';
import { CircleCheck, Info, TriangleAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { setPayeeEmail } from './api';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

export interface SettingsPanelProps {
  shopId: string;
  /** The saved PayPal email (the owner sees it in full). */
  payeeEmail: string | null;
  /** Shelfie's demo shop: with no email it is paid to Shelfie's demo PayPal account (spec §8a). */
  isDemo: boolean;
  onSaved: (payeeEmail: string | null) => void;
}

/** Settings: where the money goes. One field, one Save; checked on blur and on Save, with the same rule as the server. */
export function SettingsPanel({ shopId, payeeEmail, isDemo, onSaved }: SettingsPanelProps) {
  const toast = useToast();
  const [saved, setSaved] = useState(payeeEmail);
  const [value, setValue] = useState(payeeEmail ?? '');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  // The demo shop may clear the email (back to Shelfie's demo account); every other shop needs one.
  const blankAllowed = isDemo && value.trim() === '';
  const parsed = parsePayeeEmail(value);
  const invalid = !blankAllowed && !parsed.ok;
  const next = blankAllowed ? null : parsed.ok ? parsed.email : null;
  const unchanged = !invalid && next === saved;
  const fieldError = touched && invalid && !parsed.ok ? parsed.message : state.kind === 'error' ? state.message : undefined;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    if (unchanged) {
      setState({ kind: 'saved' }); // already what PayPal gets; nothing to send
      return;
    }
    setState({ kind: 'saving' });
    try {
      const { shop } = await setPayeeEmail(shopId, next);
      setSaved(shop.payeeEmail);
      setValue(shop.payeeEmail ?? '');
      setState({ kind: 'saved' });
      onSaved(shop.payeeEmail);
      toast({ title: 'PayPal email saved', description: 'New orders are paid to it.', tone: 'ok', durationMs: 3000 });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Couldn’t save. Try again.' });
    }
  };

  return (
    <Card as="section" aria-labelledby="settings-paid-title" padding="lg" className="flex max-w-measure flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
          <Icon icon={Wallet} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="settings-paid-title" className="type-heading">
            Where you get paid
          </h2>
          <p className="text-ink-soft">
            Buyers pay straight into the PayPal account with this email. Orders already sent to PayPal keep the email they were made with.
          </p>
        </div>
      </div>

      {!isDemo && saved === null && (
        <p className="flex items-start gap-2 rounded-md bg-warn-soft px-3.5 py-3 text-sm text-warn">
          <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
          <span>Your shop can’t take orders until you add your PayPal email.</span>
        </p>
      )}

      {isDemo && saved === null && (
        <p className="flex items-start gap-2 rounded-md bg-info-soft px-3.5 py-3 text-sm text-info" data-testid="demo-payee-note">
          <Icon icon={Info} size="sm" className="mt-0.5" />
          <span>
            This is Shelfie’s demo shop, so with no email here its orders are paid to Shelfie’s own demo PayPal account. Add an email to
            have them paid to that account instead.
          </span>
        </p>
      )}

      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field
          label="Your PayPal email"
          hint="The one you log in to PayPal with. If no PayPal account uses it, PayPal holds the money until one does."
          error={fieldError}
          required={!isDemo}
        >
          {(c) => (
            <TextInput
              {...c}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="rosa@example.com"
              value={value}
              disabled={state.kind === 'saving'}
              onChange={(e) => {
                setValue(e.currentTarget.value);
                if (state.kind !== 'idle' && state.kind !== 'saving') setState({ kind: 'idle' });
              }}
              onBlur={() => setTouched(true)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" loading={state.kind === 'saving'} loadingLabel="Saving…" className="w-full sm:w-auto">
            Save
          </Button>
          <p role="status" className="flex min-w-0 items-start gap-1.5 font-medium text-ok [overflow-wrap:anywhere]">
            {state.kind === 'saved' && unchanged && (
              <>
                <Icon icon={CircleCheck} size="sm" className="mt-1" />
                <span>Saved. New orders are paid to {saved ?? 'Shelfie’s demo account'}.</span>
              </>
            )}
          </p>
        </div>
      </form>
    </Card>
  );
}
