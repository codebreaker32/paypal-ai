'use client';

import { useState } from 'react';
import { Field, TextArea, TextInput } from '@/components/ui/field';
import { cx } from '@/components/ui/cx';
import type { ShopFulfillment } from '@/lib/domain/types';
import type { ReviewShop } from '@/lib/catalog/setup';
import { parseFeeInput, priceInputValue } from '@/lib/catalog/rules';
import { isDemoShop, parsePayeeEmail } from '@/lib/domain/payee';
import type { ShopPatch } from './api';
import { CoverPicker, LogoPicker } from './PhotoPicker';
import { PriceInput } from './PriceInput';

const OPTIONS: { value: ShopFulfillment; label: string }[] = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'both', label: 'Both' },
];

/** The wrapper of the PayPal email field: the publish bar's "Add your PayPal email" focuses the field inside it. */
export const PAYEE_FIELD_ID = 'payee-email';
/** The shop name input and the shipping fee's wrapper, for the publish bar's "To publish:" links. */
export const SHOP_NAME_INPUT_ID = 'shop-name-input';
export const SHIPPING_FEE_FIELD_ID = 'shipping-fee';

/** Whether the name and fee fields, as they stand, can be published (a blank name or an unreadable fee can't). */
export interface DetailsValidity {
  name: boolean;
  fee: boolean;
}

/**
 * Name, about, pickup notes, how orders reach people and where the money goes. Every valid change autosaves.
 * `onPayeeChange` hears whether the shop can be paid as the PayPal email field stands right now (publishing needs that):
 * a valid email, or, for the demo shop only, an empty field (`canBePaid`, the server's rule).
 */
export function ShopDetails({
  shop,
  onChange,
  onPayeeChange,
  onValidityChange,
}: {
  shop: ReviewShop;
  onChange: (p: ShopPatch) => void;
  onPayeeChange?: (valid: boolean) => void;
  onValidityChange?: (v: DetailsValidity) => void;
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
  const [logo, setLogo] = useState(shop.logoUrl ?? null);
  const [feeTouched, setFeeTouched] = useState(false);

  const feeCents = parseFeeInput(fee);
  const ships = fulfillment !== 'pickup';
  const services = shop.kind === 'services';
  const report = (next: { name?: string; fee?: string; fulfillment?: ShopFulfillment }) => {
    const n = next.name ?? name;
    const f = next.fee ?? fee;
    const ff = next.fulfillment ?? fulfillment;
    onValidityChange?.({ name: n.trim() !== '', fee: ff === 'pickup' || parseFeeInput(f) !== null });
  };

  return (
    <section aria-labelledby="shop-details-title" className="flex flex-col gap-6 border-t border-line pt-10">
      <div className="flex flex-col gap-1">
        <h2 id="shop-details-title" className="type-title">
          Your shop
        </h2>
        <p className="type-meta text-ink-muted">
          Fields marked <span className="font-semibold text-accent-ink">*</span> are needed to publish.
        </p>
      </div>

      <CoverPicker shopId={shop.id} shopName={name.trim() || shop.name} coverUrl={cover} onChange={setCover} />
      <LogoPicker shopId={shop.id} shopName={name.trim() || shop.name} logoUrl={logo} onChange={setLogo} />

      <Field label="Shop name" id={SHOP_NAME_INPUT_ID} required error={name.trim() === '' ? 'Give your shop a name' : undefined}>
        {(c) => (
          <TextInput
            {...c}
            value={name}
            maxLength={80}
            autoComplete="organization"
            onChange={(e) => {
              const v = e.currentTarget.value;
              setName(v);
              report({ name: v });
              if (v.trim()) onChange({ name: v.trim() });
            }}
          />
        )}
      </Field>

      <Field label="About" optional>
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

      <Field label={services ? 'Drop-off notes' : 'Pickup notes'} optional>
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
        <legend className="type-label mb-2">
          How do people get their order?
          <span aria-hidden="true" className="font-semibold text-accent-ink">
            {' '}*
          </span>
        </legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-sunken p-1">
          {OPTIONS.map((o) => {
            const checked = fulfillment === o.value;
            return (
              <label
                key={o.value}
                className={cx(
                  'press relative isolate flex min-h-tap cursor-pointer items-center justify-center rounded-full px-3 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                  // The selected fill sits on a pseudo-element, so it fades and scales in behind the label.
                  'before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-ink before:scale-(--press-scale) before:opacity-0 before:transition-[opacity,scale] before:duration-(--duration-fast) before:ease-out',
                  checked ? 'text-surface before:scale-100 before:opacity-100' : 'text-ink-soft hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  required
                  value={o.value}
                  checked={checked}
                  onChange={() => {
                    setFulfillment(o.value);
                    report({ fulfillment: o.value });
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
        <div id={SHIPPING_FEE_FIELD_ID} className="scroll-mt-24">
        <PriceInput
          label="Flat shipping fee"
          required
          hint="One fee per order. PayPal adds it to the buyer’s total."
          value={fee}
          onValueChange={(t) => {
            setFee(t);
            report({ fee: t });
            const c = parseFeeInput(t);
            if (c !== null) onChange({ shippingFeeCents: c });
          }}
          onBlur={() => setFeeTouched(true)}
          error={feeTouched && feeCents === null ? 'Enter a fee like 8 or 8.50' : null}
          className="w-56"
        />
        </div>
      )}

      {/* Where the money goes: each shop is paid into its seller's own PayPal account. */}
      <div id={PAYEE_FIELD_ID} className="flex scroll-mt-24 flex-col gap-3">
        <Field
          label="Your PayPal email"
          required={!payeeOptional}
          optional={payeeOptional}
          hint={
            payeeOptional
              ? 'Buyers pay you there. Left empty, this demo shop is paid to Shelfie’s demo PayPal account.'
              : 'The email you log in to PayPal with. Buyers pay you there.'
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
