// "Your orders" on this device: the receipt refs this browser has opened, kept in localStorage only (buyers have no
// accounts, and nothing about them is stored on the server for this). Every storage access may throw (private mode,
// blocked site data), so each one is wrapped and the list reads as empty when storage is off.

export const MY_ORDERS_KEY = 'shelfie:orders:v1';
export const MY_ORDERS_MAX = 50;
export const MY_ORDERS_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export interface MyOrder {
  /** The order ref (`ord_…`), the receipt's own link `/o/<ref>`. */
  ref: string;
  shopName: string;
  shopSlug: string;
  /** The order total in integer cents. */
  total: number;
  /** ISO time the order was created. */
  createdAt: string;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const REF = /^ord_[a-z0-9]{1,64}$/;

function defaultStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isMyOrder(v: unknown): v is MyOrder {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.ref === 'string' &&
    REF.test(o.ref) &&
    typeof o.shopName === 'string' &&
    typeof o.shopSlug === 'string' &&
    typeof o.total === 'number' &&
    Number.isFinite(o.total) &&
    typeof o.createdAt === 'string' &&
    !Number.isNaN(Date.parse(o.createdAt))
  );
}

/** Valid, unexpired, deduplicated by ref, newest first, at most 50. */
function tidy(list: MyOrder[], nowMs: number): MyOrder[] {
  const seen = new Set<string>();
  return list
    .filter((o) => nowMs - Date.parse(o.createdAt) <= MY_ORDERS_MAX_AGE_MS)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((o) => (seen.has(o.ref) ? false : (seen.add(o.ref), true)))
    .slice(0, MY_ORDERS_MAX);
}

/** The orders remembered on this device; an empty list when storage is off or holds something unreadable. */
export function listMyOrders(store: Store | null = defaultStore(), nowMs: number = Date.now()): MyOrder[] {
  if (!store) return [];
  try {
    const raw = store.getItem(MY_ORDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? tidy(parsed.filter(isMyOrder), nowMs) : [];
  } catch {
    return [];
  }
}

function save(list: MyOrder[], store: Store | null): void {
  if (!store) return;
  try {
    store.setItem(MY_ORDERS_KEY, JSON.stringify(list));
  } catch {
    // Storage is full or off: the list stays as it was.
  }
}

/** Adds (or refreshes) one order. Returns the list as saved. */
export function remember(order: MyOrder, store: Store | null = defaultStore(), nowMs: number = Date.now()): MyOrder[] {
  if (!isMyOrder(order)) return listMyOrders(store, nowMs);
  const list = tidy([order, ...listMyOrders(store, nowMs).filter((o) => o.ref !== order.ref)], nowMs);
  save(list, store);
  return list;
}

/** Takes one order off this device's list (the order itself and its receipt link are untouched). */
export function forget(ref: string, store: Store | null = defaultStore(), nowMs: number = Date.now()): MyOrder[] {
  const list = listMyOrders(store, nowMs).filter((o) => o.ref !== ref);
  save(list, store);
  return list;
}
