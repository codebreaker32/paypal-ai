'use client';

import type { ItemPicture } from '@/lib/domain/category';
import { useState } from 'react';
import { Bot, ChevronDown, CloudOff } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { Order, ShopKind } from '@/lib/domain/types';
import { groupOrders, groupTotalCents } from '@/lib/seller/view';
import { OrderCard } from './OrderCard';

type Filter = 'all' | 'prepare' | 'waiting' | 'done';

function Count({ n }: { n: number }) {
  return <span className="type-figures font-semibold text-ink-muted">{n}</span>;
}

/** The group's money, right-aligned on its header row: "$43.50". */
function Subtotal({ orders, label, as: Tag = 'p' }: { orders: Order[]; label: string; as?: 'p' | 'span' }) {
  if (orders.length === 0) return null;
  return (
    <Tag className="ml-auto flex items-baseline gap-2 whitespace-nowrap">
      <span className="type-meta text-ink-muted">{label}</span>
      <span className="type-price font-bold">{formatUSD(groupTotalCents(orders))}</span>
    </Tag>
  );
}

export function PayPalBanner() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-(--card-radius) bg-warn-soft px-4 py-3 text-warn">
      <Icon icon={CloudOff} className="mt-0.5" />
      <p>
        <span className="font-semibold">We can’t reach PayPal right now.</span> Payments will show up here as soon as it answers.
      </p>
    </div>
  );
}

function EmptyState({ slug, onShowShare }: { slug: string; onShowShare: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-(--card-radius) bg-surface-sunken px-6 py-10 sm:items-center sm:text-center">
      <h2 className="type-title">No orders yet</h2>
      <p className="max-w-measure text-ink-soft">Orders from AI assistants land here, ready to prepare once the buyer pays on PayPal.</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <ButtonLink href={`/s/${slug}?assistant=1`} variant="primary" icon={Bot} className="w-full sm:w-auto">
          Watch an AI order from you
        </ButtonLink>
        <button
          type="button"
          onClick={onShowShare}
          className="inline-flex min-h-tap items-center justify-center px-2 font-semibold text-ink underline underline-offset-4"
        >
          Share your agent door
        </button>
      </div>
    </div>
  );
}

const ROWS = 'divide-y divide-line overflow-hidden rounded-(--card-radius) bg-(--card-bg) shadow-(--card-shadow)';

export function OrdersPanel({
  orders,
  shopId,
  slug,
  fresh,
  photos,
  shopKind,
  paypalReachable,
  onOrderChange,
  onShowShare,
}: {
  orders: Order[];
  shopId: string;
  slug: string;
  fresh: ReadonlySet<string>;
  photos?: ReadonlyMap<string, ItemPicture>;
  shopKind?: ShopKind;
  paypalReachable: boolean;
  onOrderChange: (order: Order) => void;
  onShowShare: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const g = groupOrders(orders);
  const row = (o: Order) => <OrderCard key={o.id} order={o} shopId={shopId} photos={photos} shopKind={shopKind} fresh={fresh.has(o.id)} onChange={onOrderChange} />;
  const show = (f: Filter) => filter === 'all' || filter === f;
  const segments: [Filter, string, number][] = [
    ['all', 'All', orders.length],
    ['prepare', 'To prepare', g.toPrepare.length],
    ['waiting', 'Waiting for payment', g.waiting.length],
    ['done', 'Done', g.done.length],
  ];

  return (
    <div className="flex flex-col gap-6">
      {!paypalReachable && <PayPalBanner />}

      {orders.length === 0 ? (
        <EmptyState slug={slug} onShowShare={onShowShare} />
      ) : (
        <>
          <div role="group" aria-label="Show orders" className="no-scrollbar -mx-gutter overflow-x-auto px-gutter sm:mx-0 sm:px-0">
            <div className="inline-flex gap-1 rounded-full bg-(--segment-track) p-1">
              {segments.map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={cx(
                    'inline-flex min-h-tap items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                    filter === id ? 'bg-(--segment-on) text-ink shadow-(--card-shadow)' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {label}
                  <span className={cx('type-figures', filter === id && id === 'prepare' && n > 0 ? 'text-accent-ink' : 'text-ink-muted')}>{n}</span>
                </button>
              ))}
            </div>
          </div>

          {show('prepare') && (
            <section aria-labelledby="group-prepare" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="group-prepare" className="type-heading flex items-center gap-2">
                  To prepare <Count n={g.toPrepare.length} />
                </h2>
                <Subtotal orders={g.toPrepare} label="Paid" />
              </div>
              {g.toPrepare.length > 0 ? (
                <ul className={ROWS}>{g.toPrepare.map(row)}</ul>
              ) : (
                <p className="text-ink-muted">Nothing to prepare right now.</p>
              )}
            </section>
          )}

          {show('waiting') && g.waiting.length > 0 && (
            <details className="group" data-group="waiting" open={filter === 'waiting' || undefined}>
              <summary className="flex min-h-tap list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md [&::-webkit-details-marker]:hidden">
                <h2 className="type-heading flex items-center gap-2">
                  Waiting for payment <Count n={g.waiting.length} />
                  <Icon icon={ChevronDown} className="text-ink-muted transition-transform duration-(--duration-base) group-open:rotate-180" />
                </h2>
                {/* Not "not charged": a payment-pending order is approved and its capture is clearing at PayPal. */}
                <Subtotal orders={g.waiting} label="Not paid yet" as="span" />
              </summary>
              <ul className={cx(ROWS, 'mt-3')}>{g.waiting.map(row)}</ul>
            </details>
          )}
          {filter === 'waiting' && g.waiting.length === 0 && <p className="text-ink-muted">Nothing waiting for payment.</p>}

          {show('done') && g.done.length > 0 && (
            <section aria-labelledby="group-done" className="flex flex-col gap-3">
              <h2 id="group-done" className="type-heading flex items-center gap-2">
                Done <Count n={g.done.length} />
              </h2>
              <ul className={ROWS}>{g.done.map(row)}</ul>
            </section>
          )}
          {filter === 'done' && g.done.length === 0 && <p className="text-ink-muted">Nothing done yet.</p>}
        </>
      )}
    </div>
  );
}
