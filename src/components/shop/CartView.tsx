'use client';

import { useRouter } from 'next/navigation';
import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Textarea } from '@/components/ui/textarea';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import { MAX_QTY_PER_LINE, type CartLineView, type CheckoutChoice, type ShopCartData } from './cart';
import { ItemPhoto } from './ItemPhoto';
import { QtyStepper } from './QtyStepper';
import type { CartState } from './use-cart-state';
import './assistant-shell.css';

const NOTE_MAX = 280;

export interface CartViewProps {
  cart: CartState;
  data: ShopCartData;
  titleId: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  /** From 1024 px, where this and the assistant share one dock: how to switch to the assistant. */
  onAssistant?: () => void;
}

function Segment({ value, checked, disabled, onChange, children }: { value: CheckoutChoice; checked: boolean; disabled: boolean; onChange: (v: CheckoutChoice) => void; children: string }) {
  return (
    <label className={cx('press-text flex min-h-tap flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-[0.9375rem] font-semibold', checked ? 'bg-surface text-ink shadow-xs' : 'text-ink-soft', disabled && 'cursor-not-allowed opacity-60')}>
      <input type="radio" name="cart-fulfillment" value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="sr-only" />
      {children}
    </label>
  );
}

function Line({ line, disabled, onChange }: { line: CartLineView; disabled: boolean; onChange: (qty: number) => void }) {
  return (
    <li data-cart-line={line.name} className="flex gap-3 py-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-(--thumb-radius) bg-surface-sunken">
        <ItemPhoto name={line.name} {...line.picture} tone={line.tone} decorative sizes="48px" eager className="size-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{line.name}</p>
          <p className="shrink-0 font-semibold type-figures">{formatUSD(line.lineCents)}</p>
        </div>
        {line.optionLabel && <p className="type-meta text-ink-muted">{line.optionLabel}</p>}
        <QtyStepper value={line.qty} min={0} max={MAX_QTY_PER_LINE} label={`How many ${line.name}`} lessLabel={`Remove one ${line.name}`} moreLabel={`Add one ${line.name}`} disabled={disabled} onChange={onChange} className="mt-1 -ml-1.5" />
      </div>
    </li>
  );
}

/**
 * The buyer's order: the same view in the desktop dock and the phone sheet, in the assistant's box (header, one
 * scrolling middle, a footer that never moves). Every figure here is for display; the server prices the order.
 */
export function CartView({ cart, data, titleId, titleRef, onClose, onAssistant }: CartViewProps) {
  const router = useRouter();
  const { views, busy, fulfillment, overCap } = cart;
  const both = data.fulfillment === 'both';
  const shippingLabel = data.shippingCents > 0 ? formatUSD(data.shippingCents) : 'Free';

  return (
    <div data-cart-panel="" className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
      <div data-assistant-header="" className="flex h-(--assistant-header-h) items-center gap-3 border-b border-line px-5">
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="type-heading min-w-0 flex-1 truncate outline-none">
          Your order
        </h2>
        {onAssistant && (
          <Button variant="secondary" size="md" onClick={onAssistant}>
            Assistant
          </Button>
        )}
        <IconButton icon={X} label="Close your order" iconSize="md" onClick={onClose} className="-mr-2" />
      </div>

      <div className="overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-gutter:stable]">
        {cart.notice && (
          <p data-cart-notice="" className="mb-3 rounded-(--card-radius) bg-note-soft px-3 py-2 text-[0.9375rem] text-ink">
            {cart.notice}
          </p>
        )}
        {views.length === 0 ? (
          <div data-cart-empty="" className="flex h-full flex-col justify-center gap-1 text-center">
            <p className="type-heading">Your order</p>
            <p className="text-ink-soft">Add something from the menu and it shows up here.</p>
            {cart.error && (
              <p role="alert" className="mt-2 text-[0.9375rem] font-medium text-error">
                {cart.error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <ul className="divide-y divide-line">
              {views.map((line) => (
                <Line key={`${line.itemId}:${line.optionId}`} line={line} disabled={busy} onChange={(qty) => {
                  if (qty === 0) titleRef.current?.focus();
                  cart.setQty(line.itemId, line.optionId, qty);
                }} />
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              {both && (
                <div role="radiogroup" aria-label="How to get it" className="flex gap-1 rounded-full bg-surface-sunken p-1">
                  <Segment value="pickup" checked={fulfillment === 'pickup'} disabled={busy} onChange={cart.setFulfillment}>
                    Pickup
                  </Segment>
                  <Segment value="shipping" checked={fulfillment === 'shipping'} disabled={busy} onChange={cart.setFulfillment}>
                    {`Shipping · ${shippingLabel}`}
                  </Segment>
                </div>
              )}
              <p className="text-[0.9375rem] text-ink-soft [overflow-wrap:anywhere]">
                {fulfillment === 'shipping' ? 'PayPal asks for your address.' : data.pickupNotes || 'Ask the shop when and where to pick up.'}
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9375rem] font-bold">
                Note for the shop <span className="font-normal text-ink-muted">(optional)</span>
              </span>
              <Textarea rows={2} maxLength={NOTE_MAX} placeholder="Allergies, timing" value={cart.note} disabled={busy} onChange={(e) => cart.setNote(e.target.value)} className="resize-none" />
            </label>

            <dl data-cart-totals="" className="flex flex-col gap-1 type-receipt">
              <div className="flex justify-between gap-4">
                <dt>Items</dt>
                <dd>{formatUSD(cart.itemsCents)}</dd>
              </div>
              {fulfillment === 'shipping' && (
                <div className="flex justify-between gap-4 text-ink-soft">
                  <dt>Shipping</dt>
                  <dd>{shippingLabel}</dd>
                </div>
              )}
              <div className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-lg font-bold">
                <dt>Total</dt>
                <dd>{formatUSD(cart.totalCents)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {views.length > 0 && (
        <div data-assistant-footer="" className="flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="paypal" size="lg" fullWidth loading={busy} loadingLabel="Opening PayPal…" disabled={overCap} onClick={() => cart.checkout(() => router.refresh())}>
            Approve {formatUSD(cart.totalCents)} on PayPal
          </Button>
          {overCap && <p className="text-sm font-medium text-error">This shop takes online orders up to {formatUSD(data.orderCapCents)}.</p>}
          {cart.error && (
            <p role="alert" className="text-sm font-medium text-error">
              {cart.error}
            </p>
          )}
          <p className="type-meta text-center text-ink-muted">You review and pay on PayPal. Nothing is charged until you approve.</p>
        </div>
      )}
    </div>
  );
}

/** The one polite status line for the cart. Rendered inside a modal cart so it isn't inert with the page behind it. */
export function CartStatus({ cart }: { cart: CartState }) {
  return (
    <p role="status" aria-live="polite" data-cart-status="" className="sr-only">
      {cart.announcement}
    </p>
  );
}
