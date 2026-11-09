'use client';

import { Minus, Plus } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { useCart } from './cart-context';

/** A 44 px hit area round a 36 px face. Both sit above the tile's own button (`after:inset-0`). */
const HIT = 'press-icon relative flex size-(--add-hit) shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink';
const FACE = 'flex size-(--add-face) items-center justify-center rounded-full';

/**
 * The control in a tile's photo corner, 6 px in from its edges: `+` alone, or a white `− 2 +` pill once the item is in
 * the order. `optionId` set: the `+` adds that option. Null (several options): the `+` opens the sheet to pick one.
 * The `+` stays the same element in both forms, so focus isn't lost when the first add swaps the form, and when the
 * count reaches 0 focus goes to it.
 */
export function AddControl({ itemId, itemName, optionId }: { itemId: string; itemName: string; optionId: string | null }) {
  const cart = useCart();
  const quantity = cart.quantity(itemId);
  const inOrder = quantity > 0;
  const plus = useRef<HTMLButtonElement>(null);

  const onPlus = (e: MouseEvent<HTMLButtonElement>) => {
    if (optionId) cart.add(itemId, optionId);
    else cart.openItem(itemId, e.currentTarget);
  };
  const onMinus = () => {
    if (quantity === 1) plus.current?.focus();
    cart.decrement(itemId);
  };

  return (
    <div data-add-control="" className="absolute right-0.5 bottom-0.5 z-10 flex items-center text-ink">
      {inOrder && (
        <>
          <span aria-hidden="true" data-add-pill="" className="absolute inset-1 rounded-full bg-surface shadow-(--card-shadow)" />
          <button type="button" aria-label={`Remove one ${itemName}`} onClick={onMinus} className={HIT}>
            <Icon icon={Minus} size="sm" />
          </button>
          <span className="relative w-9 text-center text-sm font-bold type-figures">
            <span aria-hidden="true">{quantity}</span>
            <span className="sr-only">{quantity} in your order</span>
          </span>
        </>
      )}
      <button
        ref={plus}
        type="button"
        aria-label={optionId ? `Add ${itemName} to your order` : `Choose options for ${itemName}`}
        aria-haspopup={optionId ? undefined : 'dialog'}
        data-add-press={optionId ? '' : undefined}
        onClick={onPlus}
        className={HIT}
      >
        <span className={cx(FACE, !inOrder && 'bg-surface shadow-(--card-shadow)')}>
          <Icon icon={Plus} size="sm" />
        </span>
      </button>
    </div>
  );
}
