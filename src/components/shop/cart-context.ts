'use client';

import { createContext, useContext } from 'react';

/** What a tile needs from the cart. Client totals are display-only: the server prices every order. */
export interface CartApi {
  /** How many of this item are in the order, across its options. */
  quantity(itemId: string): number;
  add(itemId: string, optionId: string): void;
  /** One fewer of this item; with several options, off its most recently added line. */
  decrement(itemId: string): void;
  /** Opens the item sheet; focus returns to `opener` when it closes. */
  openItem(itemId: string, opener: HTMLElement): void;
}

/** With no provider a tile renders as an item with nothing in the order, and its controls do nothing. */
export const INERT_CART: CartApi = {
  quantity: () => 0,
  add: () => {},
  decrement: () => {},
  openItem: () => {},
};

export const CartContext = createContext<CartApi>(INERT_CART);

export const useCart = (): CartApi => useContext(CartContext);
