// The shop page's cart, as pure functions. A line is only `{itemId, optionId, qty}`: every name and price is
// joined from the server-rendered menu, and every total here is for display. The server prices the order.
import { formatUSD } from '@/lib/domain/money';
import type { ItemPicture } from '@/lib/domain/category';
import type { OrderStatus, ShopFulfillment } from '@/lib/domain/types';

/** The same limits as `ORDER_LIMITS` in `lib/orders/pricing` (a test holds them together); that module pulls in the database repos. */
export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 15;
export const CART_TTL_MS = 24 * 60 * 60 * 1000;

export interface CartLine {
  itemId: string;
  optionId: string;
  qty: number;
}

export interface CartMenuOption {
  id: string;
  label: string | null;
  cents: number;
}

/** Decided on the server, by the rule the agent door uses: only `orderable` items can join an order. */
export type CartItemState = 'orderable' | 'sold_out' | 'in_person' | 'not_taking';

export interface CartMenuItem {
  id: string;
  name: string;
  description: string;
  state: CartItemState;
  /** What can be ordered; empty unless `state` is `orderable`. */
  options: CartMenuOption[];
  /** `not_taking` only: what a cart saved before the pause still shows. Never added from: the shop is only paused. */
  heldOptions?: CartMenuOption[];
  /** The price line in the item sheet: `$3.00`, `S $3.00  L $4.00`, `From $3.00 · 3 options`; null for "ask in person". */
  priceText: string | null;
  picture: ItemPicture;
  tone: number;
  example: boolean;
}

/** What the shop page tells the cart. Built on the server by `shopCartData`. */
export interface ShopCartData {
  items: CartMenuItem[];
  fulfillment: ShopFulfillment;
  shippingCents: number;
  pickupNotes: string;
  orderCapCents: number;
}

export interface CartLineView extends CartLine {
  name: string;
  optionLabel: string | null;
  unitCents: number;
  lineCents: number;
  picture: ItemPicture;
  tone: number;
}

export interface RemovedLine {
  name: string | null;
  reason: 'sold_out' | 'unavailable';
}

const capQty = (qty: number) => Math.min(MAX_QTY_PER_LINE, qty);

/** Adds to the line of that option, or starts one. With no room left (a line at 20, an order of 15 lines) it comes back unchanged. */
export function addLine(lines: CartLine[], itemId: string, optionId: string, qty = 1): CartLine[] {
  const at = lines.findIndex((l) => l.itemId === itemId && l.optionId === optionId);
  if (at >= 0) return lines[at].qty >= MAX_QTY_PER_LINE ? lines : lines.map((l, i) => (i === at ? { ...l, qty: capQty(l.qty + qty) } : l));
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { itemId, optionId, qty: capQty(qty) }];
}

/** Why `addLine` came back unchanged, in the buyer's words. */
export const addRefusal = (lines: CartLine[], itemId: string, optionId: string): string =>
  lines.some((l) => l.itemId === itemId && l.optionId === optionId) ? `An order can hold ${MAX_QTY_PER_LINE} of each item.` : `An order can hold ${MAX_LINES} different items.`;

/** One fewer of an item, off its most recently added line. */
export function decrementItem(lines: CartLine[], itemId: string): CartLine[] {
  const at = lines.findLastIndex((l) => l.itemId === itemId);
  if (at < 0) return lines;
  return lines[at].qty > 1 ? lines.map((l, i) => (i === at ? { ...l, qty: l.qty - 1 } : l)) : lines.filter((_, i) => i !== at);
}

export function setLineQty(lines: CartLine[], itemId: string, optionId: string, qty: number): CartLine[] {
  const same = (l: CartLine) => l.itemId === itemId && l.optionId === optionId;
  if (qty <= 0) return lines.filter((l) => !same(l));
  return lines.map((l) => (same(l) ? { ...l, qty: capQty(qty) } : l));
}

export const removeItem = (lines: CartLine[], itemId: string): CartLine[] => lines.filter((l) => l.itemId !== itemId);

export const itemQuantity = (lines: CartLine[], itemId: string): number => lines.reduce((sum, l) => (l.itemId === itemId ? sum + l.qty : sum), 0);

/**
 * Lines joined to the menu. What can no longer be ordered is dropped and reported. A shop that isn't taking orders has
 * lost nothing: its lines stay, shown from `heldOptions`, and `paused` says the order can't go through yet.
 */
export function joinCart(lines: CartLine[], menu: CartMenuItem[]): { lines: CartLine[]; views: CartLineView[]; removed: RemovedLine[]; paused: boolean } {
  const byId = new Map(menu.map((item) => [item.id, item]));
  const kept: CartLine[] = [];
  const views: CartLineView[] = [];
  const removed: RemovedLine[] = [];
  let paused = false;
  for (const line of lines) {
    const item = byId.get(line.itemId);
    const offered = item?.state === 'orderable' ? item.options : item?.state === 'not_taking' ? (item.heldOptions ?? []) : [];
    const option = offered.find((o) => o.id === line.optionId);
    if (!item || !option) {
      removed.push({ name: item?.name ?? null, reason: item?.state === 'sold_out' ? 'sold_out' : 'unavailable' });
      continue;
    }
    if (item.state === 'not_taking') paused = true;
    kept.push(line);
    views.push({ ...line, name: item.name, optionLabel: option.label, unitCents: option.cents, lineCents: option.cents * line.qty, picture: item.picture, tone: item.tone });
  }
  return { lines: kept, views, removed, paused };
}

/** One line, however many were taken out. */
export function cartNotice(removed: RemovedLine[]): string | null {
  if (!removed.length) return null;
  if (removed.length > 1) return `${removed.length} items in your order are no longer available, so we took them out.`;
  const [{ name, reason }] = removed;
  if (!name) return 'Something in your order is no longer available, so we took it out.';
  return reason === 'sold_out' ? `${name} is sold out today, so we took it out.` : `${name} is no longer available, so we took it out.`;
}

export function cartTotals(views: CartLineView[], shippingCents: number) {
  const itemsCents = views.reduce((sum, v) => sum + v.lineCents, 0);
  return { count: views.reduce((sum, v) => sum + v.qty, 0), itemsCents, shippingCents, totalCents: itemsCents + shippingCents };
}

export function cartAnnouncement(name: string, change: 'added' | 'removed', count: number, itemsCents: number): string {
  if (count === 0) return `${name} ${change}. Your order is empty.`;
  return `${name} ${change}. ${count} ${count === 1 ? 'item' : 'items'}, ${formatUSD(itemsCents)}.`;
}

// ---- storage ------------------------------------------------------------------------------------

export type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const cartKey = (slug: string) => `shelfie:cart:${slug}`;
export const pendingKey = (slug: string) => `shelfie:cart:${slug}:pending`;

const isLine = (l: unknown): l is CartLine => {
  const v = l as CartLine | null;
  return !!v && typeof v.itemId === 'string' && typeof v.optionId === 'string' && Number.isInteger(v.qty) && v.qty >= 1;
};

export const serializeCart = (lines: CartLine[], now: number): string =>
  JSON.stringify({ savedAt: now, lines: lines.map(({ itemId, optionId, qty }) => ({ itemId, optionId, qty })) });

export function parseCart(raw: string | null, now: number): CartLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { savedAt?: unknown; lines?: unknown };
    if (typeof data.savedAt !== 'number' || now - data.savedAt > CART_TTL_MS || !Array.isArray(data.lines)) return [];
    return data.lines.filter(isLine).slice(0, MAX_LINES).map(({ itemId, optionId, qty }) => ({ itemId, optionId, qty: capQty(qty) }));
  } catch {
    return [];
  }
}

export function loadCart(slug: string, storage: CartStorage, now = Date.now()): CartLine[] {
  try {
    return parseCart(storage.getItem(cartKey(slug)), now);
  } catch {
    return [];
  }
}

/** Unchanged lines keep their `savedAt`, so opening the page doesn't renew the 24 hours. */
export function saveCart(slug: string, lines: CartLine[], storage: CartStorage, now = Date.now()): void {
  try {
    if (!lines.length) storage.removeItem(cartKey(slug));
    else if (JSON.stringify(parseCart(storage.getItem(cartKey(slug)), now)) !== JSON.stringify(lines.map(({ itemId, optionId, qty }) => ({ itemId, optionId, qty })))) storage.setItem(cartKey(slug), serializeCart(lines, now));
  } catch {
    // Private mode or a full disk: the cart still works until the page closes.
  }
}

export function savePendingOrder(slug: string, orderRef: string, storage: CartStorage): void {
  try {
    storage.setItem(pendingKey(slug), orderRef);
  } catch {
    // As above: the worst case is a cart that is still there after paying.
  }
}

const SETTLED: readonly OrderStatus[] = ['paid', 'payment_pending', 'fulfilled'];

/** Back from PayPal: only the order this cart became, and only once it went through. A cancelled order keeps the cart. */
export function clearCartIfPaid(slug: string, orderRef: string, status: OrderStatus, storage: CartStorage): void {
  try {
    if (!SETTLED.includes(status) || storage.getItem(pendingKey(slug)) !== orderRef) return;
    storage.removeItem(cartKey(slug));
    storage.removeItem(pendingKey(slug));
  } catch {
    // Nothing to do: storage isn't available.
  }
}

// ---- checkout ------------------------------------------------------------------------------------

export type CheckoutChoice = 'pickup' | 'shipping';

export interface CheckoutInput {
  lines: CartLine[];
  fulfillment: CheckoutChoice;
  note: string;
}

export function checkoutBody({ lines, fulfillment, note, expectedTotalCents, requestId }: CheckoutInput & { expectedTotalCents: number; requestId: string }) {
  const trimmed = note.trim();
  return {
    lines: lines.map((l) => ({ itemId: l.itemId, optionId: l.optionId, quantity: l.qty })),
    fulfillment,
    ...(trimmed ? { note: trimmed } : {}),
    expectedTotalCents,
    requestId,
  };
}

export interface RequestId {
  id: string;
  fingerprint: string;
}

/** A new id whenever the lines, the fulfilment or the note change: a request id means exactly one order. */
export function requestIdFor(current: RequestId | null, input: CheckoutInput, makeId: () => string = newRequestId): RequestId {
  const fingerprint = JSON.stringify([input.lines, input.fulfillment, input.note.trim()]);
  return current?.fingerprint === fingerprint ? current : { id: makeId(), fingerprint };
}

export function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // A page served over plain http (a phone on the LAN) has no randomUUID, but it has getRandomValues.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type RefusalAction = 'retry' | 'refresh' | 'remove' | 'show';

export function refusalAction(code: string): RefusalAction {
  switch (code) {
    case 'CHECKOUT_STALE':
    case 'IDEMPOTENCY_CONFLICT':
      return 'retry';
    case 'PRICE_CHANGED':
    case 'OPTION_REQUIRED':
      return 'refresh';
    case 'ITEM_UNAVAILABLE':
    case 'UNKNOWN_ITEM':
      return 'remove';
    default:
      return 'show';
  }
}
