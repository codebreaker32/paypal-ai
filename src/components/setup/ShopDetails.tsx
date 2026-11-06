'use client';

import { useState } from 'react';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { cx } from '@/components/ui/cx';
import type { ShopFulfillment } from '@/lib/domain/types';
import type { ReviewShop } from '@/lib/catalog/setup';
import { parseFeeInput, priceInputValue } from '@/lib/catalog/rules';
import { isDemoShop, parsePayeeEmail } from '@/lib/domain/payee';
import type { ShopPatch } from './api';
import { CoverPicker } from './PhotoPicker';
import { PriceInput } from './PriceInput';

const OPTIONS: { value: ShopFulfillment; label: string }[] = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'both', label: 'Both' },
];

/** The wrapper of the PayPal email field: the publish bar's "Add your PayPal email" focuses the field inside it. */
export const PAYEE_FIELD_ID = 'payee-email';

/**
 * Name, about, pickup notes, how orders reach people and where the money goes. Every valid change autosaves.
 * `onPayeeChange` hears whether the shop can be paid as the PayPal email field stands right now (publishing needs that):
 * a valid email, or, for the demo shop only, an empty field (`canBePaid`, the server's rule).
 */
export function ShopDetails({
  shop,
  onChange,
  onPayeeChange,
}: {
  shop: ReviewShop;
  onChange: (p: ShopPatch) => void;
  onPayeeChange?: (valid: boolean) => void;
}) {
  const [payee, setPayee] = useState(shop.payeeEmail ?? '');
  const [payeeTouched, setPayeeTouched] = useState(false);
  const payeeParsed = parsePayeeEmail(payee);
  // Only the demo shop may have no email (it is then paid to Shelfie's demo account), so only its field is optional.
  const payeeOptional = isDemoShop(shop);
  const payeeBlank = payee.trim() === '';
  const [name, setName] = useState(shop.name);
  const [about, setAbout] = useState(shop.about);
  const [pickupNotes, setPickupNotes] = useState(shop.pickupNotes);
  const [fulfillment, setFulfillment] = useState<ShopFulfillment>(shop.fulfillment);
  const [fee, setFee] = useState(priceInputValue(shop.shippingFeeCents || null));
  const [cover, setCover] = useState(shop.coverUrl ?? null);
  const [feeTouched, setFeeTouched] = useState(false);

  const feeCents = parseFeeInput(fee);
  const ships = fulfillment !== 'pickup';
  const services = shop.kind === 'services';

  return (
    <section aria-labelledby="shop-details-title" className="flex flex-col gap-6 border-t border-line pt-10">
      <h2 id="shop-details-title" className="type-title">
        Your shop
      </h2>

      <CoverPicker shopId={shop.id} shopName={name.trim() || shop.name} coverUrl={cover} onChange={setCover} />

      <Field label="Shop name" required error={name.trim() === '' ? 'Give your shop a name' : undefined}>
        {(c) => (
          <TextInput
            {...c}
            value={name}
            maxLength={80}
            autoComplete="organization"
            onChange={(e) => {
              const v = e.currentTarget.value;
              setName(v);
              if (v.trim()) onChange({ name: v.trim() });
            }}
          />
        )}
      </Field>

      <Field label="About">
        {(c) => (
          <TextArea
            {...c}
            rows={2}
            maxLength={500}
            placeholder="What you make, and when"
            value={about}
            onChange={(e) => {
              setAbout(e.currentTarget.value);
              onChange({ about: e.currentTarget.value.trim() });
            }}
          />
        )}
      </Field>

      <Field label={services ? 'Drop-off notes' : 'Pickup notes'}>
        {(c) => (
          <TextArea
            {...c}
            rows={2}
            maxLength={500}
            placeholder={services ? 'Where and when people bring things in' : 'Where and when people collect their order'}
            value={pickupNotes}
            onChange={(e) => {
              setPickupNotes(e.currentTarget.value);
              onChange({ pickupNotes: e.currentTarget.value.trim() });
            }}
          />
        )}
      </Field>

      <fieldset className="flex flex-col">
        <legend className="type-label mb-2">How do people get their order?</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-sunken p-1">
          {OPTIONS.map((o) => {
            const checked = fulfillment === o.value;
            return (
              <label
                key={o.value}
                className={cx(
                  'relative flex min-h-tap cursor-pointer items-center justify-center rounded-full px-3 font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                  checked ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-line hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={o.value}
                  checked={checked}
                  onChange={() => {
                    setFulfillment(o.value);
                    onChange({ fulfillment: o.value });
                  }}
                  className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full opacity-0"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {ships && (
        <PriceInput
          label="Flat shipping fee"
          hint="One fee per order. PayPal adds it to the buyer’s total."
          value={fee}
          onValueChange={(t) => {
            setFee(t);
            const c = parseFeeInput(t);
            if (c !== null) onChange({ shippingFeeCents: c });
          }}
          onBlur={() => setFeeTouched(true)}
          error={feeTouched && feeCents === null ? 'Enter a fee like 8 or 8.50' : null}
          className="w-56"
        />
      )}

      {/* Where the money goes (spec §8a): each shop is paid into its seller's own PayPal account. */}
      <div id={PAYEE_FIELD_ID} className="flex scroll-mt-24 flex-col gap-3">
        <Field
          label="Your PayPal email"
          required={!payeeOptional}
          hint={
            payeeOptional
              ? 'Buyers pay straight into this PayPal account. Leave it empty and this demo shop is paid to Shelfie’s demo PayPal account.'
              : 'Buyers pay straight into this PayPal account. Use the email you log in to PayPal with.'
          }
          error={payeeTouched && !payeeParsed.ok && !(payeeOptional && payeeBlank) ? payeeParsed.message : undefined}
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
              value={payee}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setPayee(v);
                const p = parsePayeeEmail(v);
                const cleared = payeeOptional && v.trim() === '';
                onPayeeChange?.(p.ok || cleared);
                if (p.ok) onChange({ payeeEmail: p.email });
                else if (cleared) onChange({ payeeEmail: null });
              }}
              onBlur={() => setPayeeTouched(true)}
            />
          )}
        </Field>
      </div>
    </section>
  );
}
