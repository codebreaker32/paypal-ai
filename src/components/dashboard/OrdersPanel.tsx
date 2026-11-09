'use client';

import type { ItemPicture } from '@/lib/domain/category';
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { PANEL_HEAD, Panel, PanelList, PanelTitle, PanelValue } from '@/components/ui/panel';
import { CountUp } from '@/components/motion/count-up';
import type { Order, ShopKind } from '@/lib/domain/types';
import { groupOrders, groupTotalCents } from '@/lib/seller/view';
import { OrderCard } from './OrderCard';

type Filter = 'all' | 'prepare' | 'waiting' | 'done';

/** The group's money, on its title row: "Paid $43.50". The word is hidden on a phone so the row stays on one line. */
function Subtotal({ orders, label }: { orders: Order[]; label: string }) {
  return (
    <>
      <span className="type-meta text-ink-muted max-sm:sr-only">{label}</span>
      <CountUp cents={groupTotalCents(orders)} className="type-price font-bold" />
    </>
  );
}

function EmptyState({ shopId, slug, onShowShare }: { shopId: string; slug: string; onShowShare: () => void }) {
  if (!slug) {
    // A draft has no address yet, so there is no shop to try or share.
    return (
      <div className="flex max-w-measure flex-col items-start gap-3">
        <h2 className="type-section">No orders yet</h2>
        <p className="text-ink-soft">Your shop takes orders once you publish it.</p>
        <ButtonLink href={`/shops/${shopId}/setup`} variant="primary" fullWidth className="mt-1 sm:w-auto">
          Finish setting up
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex max-w-measure flex-col items-start gap-3">
      <h2 className="type-section">No orders yet</h2>
      <p className="text-ink-soft">Orders from AI assistants land here, ready to prepare once the buyer pays on PayPal.</p>
      <div className="mt-1 flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
        <ButtonLink href={`/s/${slug}?assistant=1`} variant="primary" fullWidth className="sm:w-auto">
          Watch an AI order from you
        </ButtonLink>
        <button
          type="button"
          onClick={onShowShare}
          className="press-text inline-flex min-h-tap items-center justify-center px-2 font-semibold text-ink underline underline-offset-4 decoration-line-strong decoration-2 hover:decoration-ink sm:px-0"
        >
          Share your agent door
        </button>
      </div>
    </div>
  );
}

/** Over 99 a phone shows "99+", so four segments always fit; the full number stays for screen readers and wider screens. */
function SegmentCount({ n }: { n: number }) {
  if (n <= 99) return n;
  return (
    <>
      <span aria-hidden="true" className="sm:hidden">99+</span>
      <span className="max-sm:sr-only">{n}</span>
    </>
  );
}

/** The selected segment's fill, on a pseudo-element so it fades and scales in behind the label. */
const SEGMENT_THUMB =
  'before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-(--segment-on) before:shadow-(--card-shadow) ' +
  'before:scale-(--press-scale) before:opacity-0 before:transition-[opacity,scale] before:duration-(--duration-fast) before:ease-out';

export function OrdersPanel({
  orders,
  shopId,
  slug,
  fresh,
  justPaid,
  photos,
  shopKind,
  onOrderChange,
  onShowShare,
}: {
  orders: Order[];
  shopId: string;
  slug: string;
  fresh: ReadonlySet<string>;
  /** Orders the last poll saw get paid: their row glows for a moment. */
  justPaid?: ReadonlySet<string>;
  photos?: ReadonlyMap<string, ItemPicture>;
  shopKind?: ShopKind;
  onOrderChange: (order: Order) => void;
  onShowShare: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const g = groupOrders(orders);
  const row = (o: Order) => <OrderCard key={o.id} order={o} shopId={shopId} photos={photos} shopKind={shopKind} fresh={fresh.has(o.id)} justPaid={justPaid?.has(o.id)} onChange={onOrderChange} />;
  const show = (f: Filter) => filter === 'all' || filter === f;
  const segments: [Filter, ReactNode, number][] = [
    ['all', 'All', orders.length],
    ['prepare', 'To prepare', g.toPrepare.length],
    ['waiting', <>Waiting<span className="max-sm:sr-only"> for payment</span></>, g.waiting.length],
    ['done', 'Done', g.done.length],
  ];

  return (
    <div className="flex flex-col gap-6">
      {orders.length === 0 ? (
        <EmptyState shopId={shopId} slug={slug} onShowShare={onShowShare} />
      ) : (
        <>
          <div role="group" aria-label="Show orders" className="no-scrollbar -mx-gutter overflow-x-auto px-gutter sm:mx-0 sm:px-0">
            {/* `w-max min-w-full`: on a phone too narrow for the labels the pill grows with them and scrolls whole, nothing pokes out. */}
            <div className="flex w-max min-w-full gap-1 rounded-full bg-(--segment-track) p-1 sm:inline-flex sm:w-auto sm:min-w-0">
              {segments.map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={cx(
                    'press relative isolate inline-flex min-h-tap flex-auto items-center justify-center gap-1 rounded-full px-1 text-sm font-semibold whitespace-nowrap sm:flex-initial sm:gap-2 sm:px-4',
                    SEGMENT_THUMB,
                    filter === id ? 'text-ink before:scale-100 before:opacity-100' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  <span>{label}</span>
                  <span className={cx('type-figures max-sm:text-xs', filter === id && id === 'prepare' && n > 0 ? 'text-accent-ink' : 'text-ink-muted')}>
                    <SegmentCount n={n} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {show('prepare') && (
            <Panel heading="To prepare" count={g.toPrepare.length} value={g.toPrepare.length > 0 ? <Subtotal orders={g.toPrepare} label="Paid" /> : undefined}>
              {g.toPrepare.length > 0 ? <PanelList>{g.toPrepare.map(row)}</PanelList> : <p className="text-ink-muted">Nothing to prepare right now.</p>}
            </Panel>
          )}

          {show('waiting') && g.waiting.length > 0 && (
            <details className="group" data-group="waiting" open={filter === 'waiting' || undefined}>
              <summary className={cx(PANEL_HEAD, 'group/summary press-text min-h-tap list-none rounded-md [&::-webkit-details-marker]:hidden')}>
                <PanelTitle
                  heading="Waiting for payment"
                  count={g.waiting.length}
                  after={<Icon icon={ChevronDown} className="text-ink-muted transition-[rotate,color] duration-(--duration-base) group-open:rotate-180 group-hover/summary:text-ink" />}
                />
                {/* Not "not charged": a payment-pending order is approved and its capture is clearing at PayPal. */}
                <PanelValue as="span">
                  <Subtotal orders={g.waiting} label="Not paid yet" />
                </PanelValue>
              </summary>
              <PanelList className="mt-3">{g.waiting.map(row)}</PanelList>
            </details>
          )}
          {filter === 'waiting' && g.waiting.length === 0 && <p className="text-ink-muted">Nothing waiting for payment.</p>}

          {show('done') && g.done.length > 0 && (
            <Panel heading="Done" count={g.done.length}>
              <PanelList>{g.done.map(row)}</PanelList>
            </Panel>
          )}
          {filter === 'done' && g.done.length === 0 && <p className="text-ink-muted">Nothing done yet.</p>}
        </>
      )}
    </div>
  );
}
