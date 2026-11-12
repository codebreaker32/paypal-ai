'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { forget, listMyOrders, type MyOrder } from '@/lib/client/my-orders';
import { formatUSD } from '@/lib/domain/money';
import type { OrderStatusEntry } from '@/lib/orders/receipt-types';

/** A row of the list: from this device's localStorage, from the PayPal account (`GET /api/buyer/orders`), or both. */
interface Row {
  ref: string;
  shopName: string;
  total: number;
  createdAt: string;
  /** Remembered in this browser, so "Remove from this list" applies. */
  onDevice: boolean;
}

/** One entry of `GET /api/buyer/orders`. */
interface BuyerOrder {
  ref: string;
  shopName: string;
  total: number;
  createdAt: string;
  statusLabel: string;
}

const toRow = (o: { ref: string; shopName: string; total: number; createdAt: string }, onDevice: boolean): Row => ({
  ref: o.ref,
  shopName: o.shopName,
  total: o.total,
  createdAt: o.createdAt,
  onDevice,
});

/** Device rows plus PayPal rows, one per ref, newest first. */
export function mergeOrders(device: MyOrder[], fromPayPal: BuyerOrder[]): Row[] {
  const byRef = new Map<string, Row>();
  for (const o of fromPayPal) byRef.set(o.ref, toRow(o, false));
  for (const o of device) byRef.set(o.ref, toRow(o, true));
  return [...byRef.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The list on /orders: read after mount (localStorage is the browser's), then the live status words from the server.
 * With `withPayPal` (a buyer session from "Log in with PayPal"), the PayPal account's orders join the list.
 */
export function MyOrdersList({ withPayPal = false }: { withPayPal?: boolean }) {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [paypalOrders, setPayPalOrders] = useState<BuyerOrder[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!withPayPal) return;
    const ctrl = new AbortController();
    fetch('/api/buyer/orders', { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ orders: BuyerOrder[] }>) : null))
      .then((body) => {
        if (!body) return;
        setPayPalOrders(body.orders);
        setStatuses((prev) => ({ ...Object.fromEntries(body.orders.map((o) => [o.ref, o.statusLabel])), ...prev }));
      })
      .catch(() => {
        // Offline or aborted: this device's own list still shows.
      });
    return () => ctrl.abort();
  }, [withPayPal]);

  useEffect(() => {
    const list = listMyOrders();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration.
    setOrders(list);
    if (list.length === 0) return;
    const ctrl = new AbortController();
    fetch(`/api/orders/status?refs=${list.map((o) => o.ref).join(',')}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ orders: OrderStatusEntry[] }>) : null))
      .then((body) => {
        if (body) setStatuses((prev) => ({ ...prev, ...Object.fromEntries(body.orders.map((o) => [o.ref, o.statusLabel])) }));
      })
      .catch(() => {
        // Offline or aborted: the rows show without a status.
      });
    return () => ctrl.abort();
  }, []);

  if (orders === null) return <p className="mt-8 type-meta text-ink-muted">Loading your orders…</p>;

  const rows = mergeOrders(orders, paypalOrders);

  if (rows.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-start gap-4">
        <p className="type-heading">{withPayPal ? 'No orders yet' : 'No orders on this device yet'}</p>
        <p className="type-body text-ink-soft">Orders you pay for on this device show up here. Each one also has its own receipt link.</p>
        <ButtonLink href="/browse" variant="primary">
          Browse shops
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 type-body text-ink-soft">
        {withPayPal
          ? 'Orders opened on this device and orders paid with your PayPal account.'
          : 'Orders opened on this device. The list stays in this browser only.'}
      </p>
      <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
        {rows.map((o) => (
          <li key={o.ref} className="flex items-center gap-2 py-2">
            <Link
              href={`/o/${o.ref}`}
              className="press-text group flex min-h-tap min-w-0 flex-1 items-center gap-3 rounded-sm py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-ink [overflow-wrap:anywhere] group-hover:text-accent-ink">{o.shopName}</span>
                <span className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
                  <span className="type-figures">{formatUSD(o.total)}</span>
                  <span>{DATE.format(new Date(o.createdAt))}</span>
                  {statuses[o.ref] && <span className="font-semibold text-ink-soft">{statuses[o.ref]}</span>}
                </span>
              </span>
              <Icon icon={ChevronRight} size="sm" className="shrink-0 text-ink-muted" />
            </Link>
            {o.onDevice && (
              <button
                type="button"
                aria-label={`Remove from this list: ${o.shopName} order`}
                title="Remove from this list"
                onClick={() => setOrders(forget(o.ref))}
                className="press-icon inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <Icon icon={X} size="sm" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
