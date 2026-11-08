'use client';

import { useState, type FormEvent } from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { setFeedbackOn, useFeedbackOn } from '@/lib/feedback/prefs';
import { useAction } from '@/lib/feedback/use-action';
import { setPayeeEmail } from './api';
import { Switch } from './Switch';

export interface SettingsPanelProps {
  shopId: string;
  /** The saved PayPal email (the owner sees it in full). */
  payeeEmail: string | null;
  /** Shelfie's demo shop: with no email it is paid to Shelfie's demo PayPal account (spec §8a). */
  isDemo: boolean;
  onSaved: (payeeEmail: string | null) => void;
}

/** Settings: where the money goes, and this device's sound and vibration. */
export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <div className="flex flex-col gap-10">
      <PayeeSection {...props} />
      <SoundSection />
    </div>
  );
}

function SoundSection() {
  const on = useFeedbackOn();
  return (
    <section aria-labelledby="settings-sound-title" className="flex max-w-measure flex-col gap-3">
      <h2 id="settings-sound-title" className="type-title">
        Sound and vibration
      </h2>
      <Switch
        checked={on}
        onChange={setFeedbackOn}
        label="Play sounds and vibrate"
        description="Saved on this device. Keep this page open, and tap it once after opening, to hear order chimes."
      />
    </section>
  );
}

/** Where the money goes. One field, one Save; checked on blur and on Save, with the same rule as the server. */
function PayeeSection({ shopId, payeeEmail, isDemo, onSaved }: SettingsPanelProps) {
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
    <section aria-labelledby="settings-paid-title" className="flex max-w-measure flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="settings-paid-title" className="type-title">
          Where you get paid
        </h2>
        <p className="text-ink-soft">Buyers pay straight into the PayPal account with this email.</p>
      </div>

      {!isDemo && saved === null && (
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
    </section>
  );
}
