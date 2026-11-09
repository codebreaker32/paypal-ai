'use client';

import type { ReactNode } from 'react';
import { useCart } from './cart-context';

/**
 * The item's name as the button that opens its sheet. It lives in the `h4`, and its `::after` covers the whole tile, so
 * a tap anywhere on the tile opens the sheet; only the add control sits above it. Focus is drawn on that `::after`, and
 * the 2-line clamp is on the inner span so the button keeps its 44 px height.
 */
export function ItemOpen({ itemId, children }: { itemId: string; children: ReactNode }) {
  const cart = useCart();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-stretched-link=""
      onClick={(e) => cart.openItem(itemId, e.currentTarget)}
      className="block w-full cursor-pointer text-left -my-2.5 py-2.5 outline-none after:absolute after:inset-0 after:rounded-(--photo-radius) focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
    >
      <span className="line-clamp-2 [overflow-wrap:anywhere]">{children}</span>
    </button>
  );
}
