'use client';

import { useId, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import { MAX_QTY_PER_LINE, type CartItemState, type CartMenuItem } from './cart';
import { ItemPhoto } from './ItemPhoto';
import { QtyStepper } from './QtyStepper';

const FOOTER_LINE: Record<Exclude<CartItemState, 'orderable'>, string> = {
  sold_out: 'Sold out today.',
  in_person: 'Ask in person: the shop sets this price on the day.',
  not_taking: 'Not taking orders right now.',
};

export interface ItemSheetProps {
  item: CartMenuItem;
  open: boolean;
  onClose: () => void;
  onAdd: (optionId: string, qty: number) => void;
  onAsk: () => void;
  /** Where focus goes on close when the browser didn't record an opener. */
  openerRef: RefObject<HTMLElement | null>;
  /** How many of an option are already in the order: a line holds 20. */
  inOrder: (optionId: string) => number;
  /** Checkout is on its way to PayPal: the order can't change. */
  busy: boolean;
}

/** One item in full: photo, name, price, whole description, and how to order it. Mounted fresh for each opening. */
export function ItemSheet({ item, open, onClose, onAdd, onAsk, openerRef, inOrder, busy }: ItemSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const qtyLabel = useId();
  const [optionId, setOptionId] = useState(item.options[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const option = item.options.find((o) => o.id === optionId) ?? null;
  const orderable = item.state === 'orderable' && option !== null;
  // What the footer says is what gets added, so the stepper stops at the room left on the line.
  const room = option ? MAX_QTY_PER_LINE - inOrder(option.id) : 0;
  const shownQty = Math.min(qty, Math.max(room, 1));

  const media = (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        <ItemPhoto name={item.name} {...item.picture} tone={item.tone} dim={item.state === 'sold_out'} sizes="(min-width: 640px) 512px, 100vw" eager className="size-full" />
      </div>
      {item.example && <p className="px-5 pt-2 text-sm text-ink-muted sm:px-6">Example photo. The shop hasn’t added its own yet.</p>}
    </div>
  );

  const footer = orderable && room > 0 ? (
    <Button size="lg" fullWidth data-add-press="" disabled={busy} onClick={() => onAdd(option.id, shownQty)}>
      Add to order · <span className="type-figures">{formatUSD(option.cents * shownQty)}</span>
    </Button>
  ) : orderable ? (
    <p className="text-[0.9375rem] font-semibold text-ink-soft">An order can hold {MAX_QTY_PER_LINE} of each item.</p>
  ) : (
    <p className="text-[0.9375rem] font-semibold text-ink-soft">{FOOTER_LINE[item.state === 'orderable' ? 'in_person' : item.state]}</p>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item.name}
      titleRef={titleRef}
      initialFocusRef={titleRef}
      fallbackFocusRef={openerRef}
      media={media}
      footer={footer}
      description={
        <>
          {item.priceText && <p className={cx('type-price font-semibold', item.state === 'sold_out' ? 'text-ink-muted' : 'text-ink')}>{item.priceText}</p>}
          {item.state === 'in_person' && !item.priceText && <p className="type-meta font-semibold text-ink-soft">Ask in person</p>}
          {item.description && <p className="mt-2 text-ink-soft [overflow-wrap:anywhere]">{item.description}</p>}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {orderable && item.options.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[0.9375rem] font-bold">Choose one</legend>
            {item.options.map((o) => (
              <label key={o.id} className="press-text flex min-h-12 cursor-pointer items-center gap-3 rounded-(--card-radius) border border-line px-3 has-[:checked]:border-ink">
                <input type="radio" name="item-option" value={o.id} checked={o.id === optionId} onChange={() => setOptionId(o.id)} className="size-5 shrink-0 accent-ink" />
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{o.label ?? 'Standard'}</span>
                <span className="type-figures font-semibold">{formatUSD(o.cents)}</span>
              </label>
            ))}
          </fieldset>
        )}
        {orderable && room > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span id={qtyLabel} className="text-[0.9375rem] font-bold">
              How many
            </span>
            <QtyStepper value={shownQty} min={1} max={room} labelledBy={qtyLabel} lessLabel="One fewer" moreLabel="One more" onChange={setQty} />
          </div>
        )}
        <div>
          <Button variant="ghost" size="md" onClick={onAsk} className="-ml-3">
            Ask the assistant
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
