'use client';

import { useState } from 'react';
import { Package, Store, Truck, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import type { ShopFulfillment } from '@/lib/domain/types';
import type { ReviewShop } from '@/lib/catalog/setup';
import { parseFeeInput, priceInputValue } from '@/lib/catalog/rules';
import type { ShopPatch } from './api';
import { PriceInput } from './PriceInput';

const OPTIONS: { value: ShopFulfillment; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'pickup', label: 'Pickup', hint: 'They collect it', icon: Store },
  { value: 'shipping', label: 'Shipping', hint: 'You post it', icon: Truck },
  { value: 'both', label: 'Both', hint: 'They choose', icon: Package },
];

/** Name, about, pickup notes and how orders reach people. Every valid change autosaves. */
export function ShopDetails({ shop, onChange }: { shop: ReviewShop; onChange: (p: ShopPatch) => void }) {
  const [name, setName] = useState(shop.name);
  const [about, setAbout] = useState(shop.about);
  const [pickupNotes, setPickupNotes] = useState(shop.pickupNotes);
  const [fulfillment, setFulfillment] = useState<ShopFulfillment>(shop.fulfillment);
  const [fee, setFee] = useState(priceInputValue(shop.shippingFeeCents || null));
  const [feeTouched, setFeeTouched] = useState(false);

  const feeCents = parseFeeInput(fee);
  const ships = fulfillment !== 'pickup';
  const services = shop.kind === 'services';

  return (
    <Card as="section" aria-labelledby="shop-details-title" className="flex flex-col gap-5" padding="lg">
      <div className="flex flex-col gap-1">
        <h2 id="shop-details-title" className="type-title">
          Your shop
        </h2>
        <p className="text-ink-soft">Filled in from your photo. People and their assistants see this first.</p>
      </div>

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

      <Field label="About" hint="A line or two, like what you make and when.">
        {(c) => (
          <TextArea
            {...c}
            rows={2}
            maxLength={500}
            value={about}
            onChange={(e) => {
              setAbout(e.currentTarget.value);
              onChange({ about: e.currentTarget.value.trim() });
            }}
          />
        )}
      </Field>

      <Field label={services ? 'Drop-off notes' : 'Pickup notes'} hint={services ? 'Where and when people bring things in.' : 'Where and when people collect their order.'}>
        {(c) => (
          <TextArea
            {...c}
            rows={2}
            maxLength={500}
            value={pickupNotes}
            onChange={(e) => {
              setPickupNotes(e.currentTarget.value);
              onChange({ pickupNotes: e.currentTarget.value.trim() });
            }}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-label mb-3">How do people get their order?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const checked = fulfillment === o.value;
            return (
              <label
                key={o.value}
                className={cx(
                  'flex min-h-tap cursor-pointer items-center gap-3 rounded-md border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                  checked ? 'border-ink bg-surface-sunken' : 'border-control hover:border-ink-soft',
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
                  className="size-4 accent-ink focus-visible:outline-none"
                />
                <Icon icon={o.icon} className="text-ink-soft" />
                <span className="flex flex-col">
                  <span className="font-semibold">{o.label}</span>
                  <span className="type-meta text-ink-muted">{o.hint}</span>
                </span>
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
    </Card>
  );
}
