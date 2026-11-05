'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ChevronDown, CircleCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, FieldError, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { OFFERED_CARRIERS, type CarrierId } from '@/lib/seller/carriers';
import { ApiError, addTracking } from './api';

const SELECT =
  'w-full min-h-(--field-h) appearance-none rounded-(--field-radius) border border-(--field-border) bg-(--field-bg) pl-3.5 pr-10 ' +
  'text-base text-ink transition-[border-color] hover:border-ink-soft focus-visible:border-(--field-border-focus)';

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; carrier: string; trackingNumber: string } | { kind: 'error'; message: string };

/** Carrier + tracking number → PayPal (through Shelfie's toolkit route). States: sending, sent, PayPal's error. */
export function TrackingForm({ shopId, orderId }: { shopId: string; orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [carrier, setCarrier] = useState<CarrierId>('USPS');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ number?: string; name?: string }>({});
  const [state, setState] = useState<State>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const number = trackingNumber.replace(/\s+/g, '');
    const errors: typeof fieldErrors = {};
    if (number.length < 5) errors.number = 'Enter the tracking number from the shipping label.';
    if (carrier === 'OTHER' && !carrierName.trim()) errors.name = 'Enter the name of the carrier.';
    setFieldErrors(errors);
    if (errors.number || errors.name) return;

    setState({ kind: 'sending' });
    try {
      const { trackers } = await addTracking(shopId, orderId, {
        carrier,
        trackingNumber: number,
        ...(carrier === 'OTHER' ? { carrierName: carrierName.trim() } : {}),
      });
      const t = trackers.at(-1);
      setState({ kind: 'sent', carrier: t?.carrier ?? carrier, trackingNumber: t?.trackingNumber ?? number });
      toast({ title: 'Tracking sent to PayPal', description: 'The order moved to Done.', tone: 'ok' });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors({ number: err.message });
        setState({ kind: 'idle' });
      } else {
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
      }
    }
  };

  if (state.kind === 'sent') {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md bg-ok-soft px-3 py-2.5 font-medium text-ok">
        <Icon icon={CircleCheck} className="mt-0.5" />
        <span>
          Sent to PayPal: {state.carrier} <span className="type-price font-semibold">{state.trackingNumber}</span>
        </span>
      </p>
    );
  }

  const sending = state.kind === 'sending';
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Add tracking">
      <Field label="Carrier">
        {(p) => (
          <div className="relative">
            <select
              {...p}
              value={carrier}
              disabled={sending}
              onChange={(e) => setCarrier(e.target.value as CarrierId)}
              className={SELECT}
            >
              {OFFERED_CARRIERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <Icon icon={ChevronDown} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft" />
          </div>
        )}
      </Field>
      {carrier === 'OTHER' && (
        <Field label="Carrier name" error={fieldErrors.name}>
          {(p) => (
            <TextInput
              {...p}
              value={carrierName}
              disabled={sending}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => setCarrierName(e.target.value)}
            />
          )}
        </Field>
      )}
      <Field label="Tracking number" hint="Paste it from the label. Spaces are fine." error={fieldErrors.number}>
        {(p) => (
          <TextInput
            {...p}
            value={trackingNumber}
            disabled={sending}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={60}
            className="type-price"
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
        )}
      </Field>
      {state.kind === 'error' && <FieldError>{state.message}</FieldError>}
      <Button type="submit" icon={Send} loading={sending} loadingLabel="Sending to PayPal…" className="w-full sm:w-auto sm:self-start">
        Send tracking to PayPal
      </Button>
    </form>
  );
}
