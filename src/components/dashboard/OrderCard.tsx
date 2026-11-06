'use client';

import Link from 'next/link';
import { Loader2, Truck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { formatUSD } from '@/lib/domain/money';
import type { Order } from '@/lib/domain/types';
import { agentLabel, buyerLabel, itemSummary, whereLabel } from '@/lib/seller/view';
import { LocalTime } from './LocalTime';
import { MarkPickedUpButton } from './MarkPickedUpButton';
import { OrderStatusText } from './status';

const MUTED = new Set<Order['status']>(['failed', 'cancelled', 'expired']);

/** The brief on a row that still needs the seller (paid): its headline, and the first warning. */
function BriefLine({ order }: { order: Order }) {
  if (order.status !== 'paid') return null;
  if (!order.brief) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Icon icon={Loader2} size="sm" className="animate-spin" />
        Writing the brief…
      </p>
    );
  }
  const warns = order.brief.flags.filter((f) => f.severity === 'warn');
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="font-semibold">
        <span className="mr-1.5 font-bold text-accent-ink">{order.briefSource === 'agent' ? 'AI brief' : 'Summary'}</span>
        {order.brief.headline}
      </p>
      {warns[0] && (
        <p className="font-medium text-warn">
          {warns[0].text}
          {warns.length > 1 && <span className="text-ink-soft"> (+{warns.length - 1} more)</span>}
        </p>
      )}
    </div>
  );
}

/** One order as a dense row: thumbnail, number and buyer, items, total, status, and the next action when it's paid. */
export function OrderCard({
  order,
  shopId,
  fresh,
  photos,
  onChange,
}: {
  order: Order;
  shopId: string;
  fresh?: boolean;
  /** itemId -> photo URL, for the first line's thumbnail. */
  photos?: ReadonlyMap<string, string | null>;
  onChange: (order: Order) => void;
}) {
  const href = `/shops/${shopId}/orders/${order.id}`;
  const muted = MUTED.has(order.status);
  const ships = order.fulfillment === 'shipping';
  const first = order.lines[0];
  const more = order.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <li
      data-order={order.number}
      className={cx(
        'relative grid grid-cols-[3.5rem_1fr_auto] gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-surface-subtle sm:px-5',
        'lg:grid-cols-[3.5rem_13rem_minmax(0,1fr)_5.5rem_10rem_10.5rem] lg:items-center',
        fresh && 'animate-rise-in motion-reduce:animate-none',
      )}
    >
      <span className="relative row-span-2 lg:row-span-1">
        <ItemPhoto
          name={first?.name ?? order.number}
          photoUrl={first ? (photos?.get(first.itemId) ?? null) : null}
          size="sm"
          decorative
          dim={muted}
          className="size-14 rounded-(--thumb-radius)"
        />
        {more > 1 && (
          <span className="absolute -right-1.5 -bottom-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.6875rem] font-bold text-surface tabular-nums ring-2 ring-surface">
            {more}
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-col">
        <h3 className="type-price font-bold whitespace-nowrap">
          <Link
            href={href}
            data-stretched-link
            className={cx(
              'no-underline hover:underline focus-visible:outline-none',
              'after:absolute after:inset-0 after:content-[""]',
              'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus',
            )}
          >
            {order.number}
          </Link>
        </h3>
        <p className="truncate text-sm text-ink-muted">
          {buyerLabel(order)} · via {agentLabel(order.agentName)} · <LocalTime iso={order.paidAt ?? order.createdAt} />
        </p>
      </div>

      <p className={cx('type-price text-right font-bold whitespace-nowrap lg:order-4', muted && 'text-ink-muted line-through decoration-1')}>
        <span className="sr-only">Total </span>
        {formatUSD(order.totalCents)}
      </p>

      <div className={cx('col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-1 lg:order-3', muted && 'text-ink-muted')}>
        <p className="text-sm">
          {itemSummary(order.lines)}
          <span className="text-ink-muted"> · {whereLabel(order)}</span>
        </p>
        <BriefLine order={order} />
        {order.status === 'awaiting_approval' && (
          <p className="text-sm text-ink-muted">
            Link expires <LocalTime iso={order.expiresAt} />
          </p>
        )}
      </div>

      <OrderStatusText order={order} className="col-start-2 lg:order-5 lg:col-start-auto" />

      <div className="relative z-10 col-span-3 lg:order-6 lg:col-span-1 lg:justify-self-end">
        {order.status === 'paid' &&
          (ships ? (
            <ButtonLink href={`${href}#tracking`} variant="secondary" icon={Truck} className="w-full lg:w-auto">
              Add tracking
            </ButtonLink>
          ) : (
            <MarkPickedUpButton shopId={shopId} order={order} onDone={onChange} />
          ))}
      </div>
    </li>
  );
}
