'use client';

import type { ReactNode } from 'react';
import { Bot, ChevronDown, CloudOff, Inbox } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { Order } from '@/lib/domain/types';
import { groupOrders } from '@/lib/seller/view';
import { LEDGER_COLUMNS, OrderCard } from './OrderCard';

function Count({ n }: { n: number }) {
  return (
    <span className="type-price inline-flex min-w-7 justify-center rounded-xs border border-line-strong bg-surface-raised px-1.5 font-sans text-sm font-semibold text-ink-soft">
      {n}
    </span>
  );
}

/** Group subtotal, right-aligned like a ledger page total. */
function Subtotal({ orders, label }: { orders: Order[]; label: string }) {
  if (orders.length === 0) return null;
  const cents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  return (
    <p className="flex items-baseline gap-2 text-ink-muted">
      <span className="type-meta">{label}</span>
      <span className="type-amount text-lg text-ink">{formatUSD(cents)}</span>
    </p>
  );
}

/** One ruled panel per group: a column head on desktop, then a row per order. */
function Ledger({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-(--card-radius) border border-(--card-border) bg-(--card-bg) shadow-(--card-shadow)">
      <div
        aria-hidden="true"
        className={cx(
          'hidden border-b border-(--ledger-rule) bg-(--ledger-head-bg) px-5 py-2 type-stamp text-ink-muted lg:grid',
          LEDGER_COLUMNS,
        )}
      >
        <span>Order</span>
        <span>Items and delivery</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>
      <ul className="divide-y divide-(--ledger-rule)">{children}</ul>
    </div>
  );
}

export function PayPalBanner() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-md bg-warn-soft px-4 py-3 text-warn">
      <Icon icon={CloudOff} className="mt-0.5" />
      <p>
        <span className="font-semibold">We can’t reach PayPal right now.</span>{' '}
        Payments buyers make on PayPal will show up here as soon as it answers. Nothing is lost.
      </p>
    </div>
  );
}

function EmptyState({ slug, onShowShare }: { slug: string; onShowShare: () => void }) {
  return (
    <Card tone="flat" padding="lg" className="flex flex-col items-start gap-4">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Icon icon={Inbox} size="lg" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="type-heading">No orders yet</h2>
        <p className="max-w-measure text-ink-soft">
          When an AI assistant orders through your agent door, the order shows up here, ready to prepare as soon as the buyer pays on PayPal.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <ButtonLink href={`/s/${slug}?assistant=1`} variant="primary" icon={Bot} className="w-full sm:w-auto">
          Watch an AI order from you
        </ButtonLink>
        <button
          type="button"
          onClick={onShowShare}
          className="inline-flex min-h-tap items-center justify-center px-2 font-semibold text-accent-ink underline underline-offset-4 hover:text-accent-active"
        >
          Share your agent door
        </button>
      </div>
    </Card>
  );
}

export function OrdersPanel({
  orders,
  shopId,
  slug,
  fresh,
  paypalReachable,
  onOrderChange,
  onShowShare,
}: {
  orders: Order[];
  shopId: string;
  slug: string;
  fresh: ReadonlySet<string>;
  paypalReachable: boolean;
  onOrderChange: (order: Order) => void;
  onShowShare: () => void;
}) {
  const g = groupOrders(orders);
  const card = (o: Order) => <OrderCard key={o.id} order={o} shopId={shopId} fresh={fresh.has(o.id)} onChange={onOrderChange} />;

  return (
    <div className="flex flex-col gap-8">
      {!paypalReachable && <PayPalBanner />}

      {orders.length === 0 ? (
        <EmptyState slug={slug} onShowShare={onShowShare} />
      ) : (
        <>
          <section aria-labelledby="group-prepare" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 id="group-prepare" className="type-heading flex items-center gap-2">
                To prepare <Count n={g.toPrepare.length} />
              </h2>
              <Subtotal orders={g.toPrepare} label="Paid" />
            </div>
            {g.toPrepare.length > 0 ? (
              <Ledger>{g.toPrepare.map(card)}</Ledger>
            ) : (
              <p className="rounded-(--card-radius) border border-dashed border-control px-4 py-5 text-ink-muted">
                Nothing to prepare right now. Paid orders show up here.
              </p>
            )}
          </section>

          {g.waiting.length > 0 && (
            <details className="group" data-group="waiting">
              <summary className="flex min-h-tap list-none flex-wrap items-center justify-between gap-x-4 rounded-md [&::-webkit-details-marker]:hidden">
                <h2 className="type-heading flex items-center gap-2">
                  Waiting for payment <Count n={g.waiting.length} />
                  <Icon icon={ChevronDown} className="text-ink-muted transition-transform duration-(--duration-base) group-open:rotate-180" />
                </h2>
                <Subtotal orders={g.waiting} label="Not charged yet" />
              </summary>
              <div className="mt-1 flex flex-col gap-3">
                <p className="type-meta text-ink-muted">
                  The buyer still has to approve on PayPal. Nothing is charged until they do, and unpaid orders expire after 60 minutes.
                </p>
                <Ledger>{g.waiting.map(card)}</Ledger>
              </div>
            </details>
          )}

          {g.done.length > 0 && (
            <section aria-labelledby="group-done" className="flex flex-col gap-3">
              <h2 id="group-done" className="type-heading flex items-center gap-2">
                Done <Count n={g.done.length} />
              </h2>
              <Ledger>{g.done.map(card)}</Ledger>
            </section>
          )}
        </>
      )}
    </div>
  );
}
