'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { LogoPicker } from '@/components/setup/PhotoPicker';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { TextLink } from '@/components/ui/text-link';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { setFeedbackOn, useFeedbackOn } from '@/lib/feedback/prefs';
import { useAction } from '@/lib/feedback/use-action';
import { setPayeeEmail } from './api';
import { Switch } from './Switch';

export interface SettingsPanelProps {
  shopId: string;
  shopName: string;
  /** The saved PayPal email (the owner sees it in full). */
  payeeEmail: string | null;
  /** Shelfie's demo shop: with no email it is paid to Shelfie's demo PayPal account (spec §8a). */
  isDemo: boolean;
  /** A draft isn't told by the shell's banner that it needs an email, so the section says so itself. */
  draft: boolean;
  onSaved: (payeeEmail: string | null) => void;
  logoUrl: string | null;
  onLogoChange: (logoUrl: string | null) => void;
  /** The signed-in account's email, or null when there is none. */
  accountEmail: string | null;
}

/** A settings section: its name on the left, the control on the right. The first has no rule above it. */
function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid grid-cols-1 gap-x-10 gap-y-3 border-t border-line py-6 first:border-t-0 first:pt-0 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="type-section">
          {title}
        </h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      <div className="min-w-0 max-w-lg">{children}</div>
    </section>
  );
}

/** Where the money goes: one field, one Save; checked on blur and on Save, with the same rule as the server. */
function PayeeForm({ shopId, payeeEmail, isDemo, draft, onSaved }: Pick<SettingsPanelProps, 'shopId' | 'payeeEmail' | 'isDemo' | 'draft' | 'onSaved'>) {
  const [saved, setSaved] = useState(payeeEmail);
  const [value, setValue] = useState(payeeEmail ?? '');
  const [touched, setTouched] = useState(false);
  // Pressed Save since the last edit: the result sentence and a failure only speak for what is in the field now.
  const [submitted, setSubmitted] = useState(false);

  // The demo shop may clear the email (back to Shelfie's demo account); every other shop needs one.
  const blankAllowed = isDemo && value.trim() === '';
  const parsed = parsePayeeEmail(value);
  const invalid = !blankAllowed && !parsed.ok;
  const next = blankAllowed ? null : parsed.ok ? parsed.email : null;
  const unchanged = !invalid && next === saved;

  const { status, run, error } = useAction(() => setPayeeEmail(shopId, next));
  // Saved speaks for the value it saved: once the field differs, Save works again and the edit isn't dropped by the hold.
  const buttonStatus = status === 'success' && !unchanged ? 'idle' : status;
  const fieldError = touched && invalid && !parsed.ok ? parsed.message : submitted && !unchanged && error ? error : undefined;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setSubmitted(true);
    if (unchanged) return; // already what PayPal gets; nothing to send
    const done = await run();
    if (!done) return;
    setSaved(done.shop.payeeEmail);
    setValue(done.shop.payeeEmail ?? '');
    onSaved(done.shop.payeeEmail);
  };

  return (
    <form onSubmit={save} noValidate data-testid="payee-form" className="flex flex-col gap-4">
      {!isDemo && saved === null && draft && (
        <p className="flex items-start gap-2 rounded-(--card-radius) bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
          <span>Your shop can’t take orders until you add your PayPal email.</span>
        </p>
      )}

      {isDemo && saved === null && (
        <p className="flex items-start gap-2 rounded-(--card-radius) bg-info-soft px-4 py-3 text-sm text-info" data-testid="demo-payee-note">
          <Icon icon={Info} size="sm" className="mt-0.5" />
          <span>
            Shelfie’s demo shop: with no email, its orders are paid to Shelfie’s demo PayPal account. Add one to be paid there instead.
          </span>
        </p>
      )}

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
            disabled={status === 'loading'}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              setSubmitted(false);
            }}
            onBlur={() => setTouched(true)}
          />
        )}
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" status={buttonStatus} loadingLabel="Saving…" successLabel="Saved" fullWidth className="sm:w-auto">
          Save
        </Button>
        <p role="status" className="flex min-w-0 items-start gap-1.5 font-medium text-ok [overflow-wrap:anywhere]">
          {submitted && unchanged && status !== 'loading' && (
            <>
              <Icon icon={CircleCheck} size="sm" className="mt-1" />
              <span>Saved. New orders are paid to {saved ?? 'Shelfie’s demo account'}.</span>
            </>
          )}
        </p>
      </div>
    </form>
  );
}

/** One switch for this device's click sounds, order chime and vibration. */
function SoundSwitch() {
  const on = useFeedbackOn();
  return (
    <Switch
      checked={on}
      onChange={setFeedbackOn}
      label="Play sounds and vibrate"
      description="Saved on this device. Keep this page open, and tap it once after opening, to hear order chimes."
    />
  );
}

/** Settings: where you get paid, your logo, and how you sign in, each a titled row of its own. */
export function SettingsPanel({ shopName, logoUrl, onLogoChange, accountEmail, ...payee }: SettingsPanelProps) {
  return (
    <div className="flex flex-col">
      <SettingsSection title="Where you get paid" description="Buyers pay straight into the PayPal account with this email.">
        <PayeeForm {...payee} />
      </SettingsSection>
      <SettingsSection title="Sound and vibration">
        <SoundSwitch />
      </SettingsSection>
      <SettingsSection title="Your logo">
        <LogoPicker shopId={payee.shopId} shopName={shopName} logoUrl={logoUrl} onChange={onLogoChange} titled={false} />
      </SettingsSection>
      <SettingsSection title="Sign-in">
        {accountEmail ? (
          <div className="flex flex-col items-start gap-1">
            <p className="[overflow-wrap:anywhere]">Signed in as {accountEmail}</p>
            <TextLink href="/account">Account settings</TextLink>
          </div>
        ) : (
          <ButtonLink href="/login" variant="secondary">
            Log in
          </ButtonLink>
        )}
      </SettingsSection>
    </div>
  );
}
