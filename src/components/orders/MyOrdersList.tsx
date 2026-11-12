'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { forget, listMyOrders, type MyOrder } from '@/lib/client/my-orders';
import { formatUSD } from '@/lib/domain/money';
import type { OrderStatusEntry } from '@/lib/orders/receipt-types';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** The list on /orders: read after mount (localStorage is the browser's), then the live status words from the server. */
export function MyOrdersList() {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    const list = listMyOrders();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration.
    setOrders(list);
    if (list.length === 0) return;
    const ctrl = new AbortController();
    fetch(`/api/orders/status?refs=${list.map((o) => o.ref).join(',')}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ orders: OrderStatusEntry[] }>) : null))
      .then((body) => {
        if (body) setStatuses(Object.fromEntries(body.orders.map((o) => [o.ref, o.statusLabel])));
      })
      .catch(() => {
        // Offline or aborted: the rows show without a status.
      });
    return () => ctrl.abort();
  }, []);

  if (orders === null) return <p className="mt-8 type-meta text-ink-muted">Loading your orders…</p>;

  if (orders.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-start gap-4">
        <p className="type-heading">No orders on this device yet</p>
        <p className="type-body text-ink-soft">Orders you pay for on this device show up here. Each one also has its own receipt link.</p>
        <ButtonLink href="/browse" variant="primary">
          Browse shops
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 type-body text-ink-soft">Orders opened on this device. The list stays in this browser only.</p>
      <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
        {orders.map((o) => (
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
            <button
              type="button"
              aria-label={`Remove from this list: ${o.shopName} order`}
              title="Remove from this list"
              onClick={() => setOrders(forget(o.ref))}
              className="press-icon inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Icon icon={X} size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
