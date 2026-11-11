'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalToast } from '@/components/ui/toast';
import { formatUSD } from '@/lib/domain/money';
import { feedback } from '@/lib/feedback';
import { isPayPalApprovalUrl } from './activity-format';
import {
  addLine,
  addRefusal,
  cartAnnouncement,
  cartNotice,
  cartTotals,
  checkoutBody,
  decrementItem,
  itemQuantity,
  joinCart,
  loadCart,
  refusalAction,
  removeItem,
  requestIdFor,
  saveCart,
  savePendingOrder,
  setLineQty,
  type CartLine,
  type CartLineView,
  type CheckoutChoice,
  type RequestId,
  type ShopCartData,
} from './cart';

const PAYPAL_DOWN = 'We can’t reach PayPal right now. Your order is saved here. Try again in a moment.';

export interface CartState {
  lines: CartLine[];
  views: CartLineView[];
  count: number;
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  overCap: boolean;
  /** The shop isn't taking orders: the lines are kept and shown, and nothing can be approved until it is back. */
  paused: boolean;
  fulfillment: CheckoutChoice;
  note: string;
  busy: boolean;
  error: string | null;
  notice: string | null;
  announcement: string;
  quantity: (itemId: string) => number;
  /** True when the line went in; false when it was refused (the refusal is already told). */
  add: (itemId: string, optionId: string, qty?: number) => boolean;
  decrement: (itemId: string) => void;
  setQty: (itemId: string, optionId: string, qty: number) => void;
  setFulfillment: (f: CheckoutChoice) => void;
  setNote: (note: string) => void;
  /** `refresh` re-reads the menu from the server after a price change. */
  checkout: (refresh: () => void) => void;
}

/** The cart behind `CartContext`, the cart view and the order buttons. Saved to the device, joined to the menu on every load. */
export function useCartState(slug: string, data: ShopCartData): CartState {
  const toast = useOptionalToast();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [restored, setRestored] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [fulfillment, setFulfillmentState] = useState<CheckoutChoice>(data.fulfillment === 'shipping' ? 'shipping' : 'pickup');
  const [note, setNoteState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linesRef = useRef(lines);
  const requestId = useRef<RequestId | null>(null);
  /** The order on its way to PayPal is the one on screen: nothing changes it until the answer. */
  const busyRef = useRef(false);
  const setBusyNow = useCallback((on: boolean) => {
    busyRef.current = on;
    setBusy(on);
  }, []);

  const apply = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
    setError(null);
  }, []);

  // After hydration, so server and first client render agree on an empty cart.
  useEffect(() => {
    let saved: CartLine[] = [];
    try {
      saved = loadCart(slug, window.localStorage);
    } catch {
      // Storage is off: start empty.
    }
    linesRef.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's cart is only readable after hydration
    setLines(saved);
    setRestored(true);
  }, [slug]);

  const joined = useMemo(() => joinCart(lines, data.items), [lines, data.items]);

  // What is no longer on the menu leaves the cart, on load and whenever the server sends a new menu.
  useEffect(() => {
    if (!restored || !joined.removed.length) return;
    const message = cartNotice(joined.removed);
    linesRef.current = joined.lines;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the join needs the menu and the restored lines together
    setLines(joined.lines);
    setNotice(message);
    if (message) toast?.({ title: message });
  }, [restored, joined, toast]);

  useEffect(() => {
    if (!restored) return;
    try {
      saveCart(slug, lines, window.localStorage);
    } catch {
      // Storage is off: the cart lasts until the page closes.
    }
  }, [restored, slug, lines]);

  // Back from PayPal through the browser's back-forward cache: the page wakes up as it was left, mid-redirect.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusyNow(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [setBusyNow]);

  const shippingCents = fulfillment === 'shipping' ? data.shippingCents : 0;
  const totals = cartTotals(joined.views, shippingCents);
  const nameOf = useCallback((itemId: string) => data.items.find((i) => i.id === itemId)?.name ?? 'Item', [data.items]);

  const announce = useCallback(
    (itemId: string, change: 'added' | 'removed', next: CartLine[]) => {
      const t = cartTotals(joinCart(next, data.items).views, 0);
      setAnnouncement(cartAnnouncement(nameOf(itemId), change, t.count, t.itemsCents));
    },
    [data.items, nameOf],
  );

  const add = useCallback(
    (itemId: string, optionId: string, qty = 1): boolean => {
      if (busyRef.current) return false;
      const next = addLine(linesRef.current, itemId, optionId, qty);
      if (next === linesRef.current) {
        const message = addRefusal(next, itemId, optionId);
        setAnnouncement(message);
        toast?.({ title: message });
        feedback('tick'); // A press on a live control still answers; this add control leaves its tick to us.
        return false;
      }
      apply(next);
      setNotice(null);
      announce(itemId, 'added', next);
      feedback('add');
      return true;
    },
    [announce, apply, toast],
  );

  const decrement = useCallback(
    (itemId: string) => {
      if (busyRef.current) return;
      const next = decrementItem(linesRef.current, itemId);
      apply(next);
      announce(itemId, 'removed', next);
    },
    [announce, apply],
  );

  const setQty = useCallback(
    (itemId: string, optionId: string, qty: number) => {
      if (busyRef.current) return;
      const before = linesRef.current.find((l) => l.itemId === itemId && l.optionId === optionId)?.qty ?? 0;
      const next = setLineQty(linesRef.current, itemId, optionId, qty);
      apply(next);
      announce(itemId, qty > before ? 'added' : 'removed', next);
    },
    [announce, apply],
  );

  const setFulfillment = useCallback((f: CheckoutChoice) => {
    if (busyRef.current) return;
    setFulfillmentState(f);
    setError(null);
  }, []);
  const setNote = useCallback((n: string) => {
    if (busyRef.current) return;
    setNoteState(n);
    setError(null);
  }, []);

  const quantity = useCallback((itemId: string) => itemQuantity(lines, itemId), [lines]);

  const checkout = useCallback((refresh: () => void) => {
    if (busyRef.current) return;
    // One order, priced once: a retry sends exactly what the first attempt sent, with the total it was worked out from.
    const input = { lines: linesRef.current, fulfillment, note };
    const expectedTotalCents = totals.totalCents;
    const attempt = async (retried: boolean): Promise<void> => {
      requestId.current = requestIdFor(requestId.current, input);
      setBusyNow(true);
      setError(null);
      const fail = (message: string) => {
        setBusyNow(false);
        setError(message);
        feedback('error');
      };
      let res: Response;
      try {
        res = await fetch(`/api/checkout/${encodeURIComponent(slug)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(checkoutBody({ ...input, expectedTotalCents, requestId: requestId.current.id })),
        });
      } catch {
        return fail(PAYPAL_DOWN);
      }
      const body = (await res.json().catch(() => null)) as { orderRef?: string; approvalUrl?: string; error?: { code?: string; message?: string; itemId?: string } } | null;

      if (res.ok && body?.orderRef && body.approvalUrl) {
        // SR30: the only place the buyer leaves for, and only when it is PayPal over HTTPS.
        if (!isPayPalApprovalUrl(body.approvalUrl)) return fail(PAYPAL_DOWN);
        try {
          savePendingOrder(slug, body.orderRef, window.localStorage);
        } catch {
          // The cart then outlives the payment; the buyer can empty it.
        }
        window.location.assign(body.approvalUrl);
        return; // Stays busy until the page goes.
      }

      const code = body?.error?.code ?? 'SERVER_ERROR';
      const message = body?.error?.message ?? PAYPAL_DOWN;
      const action = refusalAction(code);
      if (action === 'retry' && !retried) {
        requestId.current = null;
        return attempt(true);
      }
      if (action === 'remove') {
        const itemId = body?.error?.itemId;
        if (itemId) {
          const next = removeItem(linesRef.current, itemId);
          linesRef.current = next;
          setLines(next);
          announce(itemId, 'removed', next);
        }
      }
      if (action === 'refresh') {
        requestId.current = null;
        refresh();
      }
      fail(message);
    };
    void attempt(false);
  }, [announce, fulfillment, note, setBusyNow, slug, totals.totalCents]);

  return {
    lines,
    views: joined.views,
    ...totals,
    overCap: totals.totalCents > data.orderCapCents,
    paused: joined.paused,
    fulfillment,
    note,
    busy,
    error,
    notice,
    announcement,
    quantity,
    add,
    decrement,
    setQty,
    setFulfillment,
    setNote,
    checkout,
  };
}

/** `View order · 3   $19.00`, as one string for a button's accessible name. */
export const viewOrderLabel = (count: number, itemsCents: number) => `View order · ${count}   ${formatUSD(itemsCents)}`;
