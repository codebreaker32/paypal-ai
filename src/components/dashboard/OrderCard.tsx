'use client';

import Link from 'next/link';
import { Loader2, Truck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { Pressable } from '@/components/motion/pressable';
import type { ItemPicture } from '@/lib/domain/category';
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
        <span className="mr-1.5 font-bold text-note">{order.briefSource === 'agent' ? 'AI brief' : 'Summary'}</span>
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
  justPaid,
  photos,
  onChange,
}: {
  order: Order;
  shopId: string;
  /** Just arrived or just moved here: the row rises in. */
  fresh?: boolean;
  /** The last poll saw it get paid: a soft ok glow that fades over 2.4 s. */
  justPaid?: boolean;
  /** itemId -> photo URL, for the first line's thumbnail. */
  photos?: ReadonlyMap<string, ItemPicture>;
  onChange: (order: Order) => void;
}) {
  const href = `/shops/${shopId}/orders/${order.id}`;
  const muted = MUTED.has(order.status);
  const ships = order.fulfillment === 'shipping';
  const first = order.lines[0];

  return (
    <Pressable
      as="li"
      lift={false}
      data-order={order.number}
      data-just-paid={justPaid || undefined}
      className={cx(
        'isolate grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-4 sm:px-5',
        'transition-[transform,background-color] hover:bg-surface-subtle active:scale-[0.99]',
        'lg:grid-cols-[3.5rem_14rem_minmax(0,1fr)_7rem_11rem_10.5rem] lg:items-center',
        fresh && 'animate-rise-in motion-reduce:animate-none',
      )}
    >
      {/* Behind the content (the row is its own stacking context): fades out on its own, so nothing is left to clean up. */}
      {justPaid && <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-ok-soft animate-paid-glow" />}
      <ItemPhoto
        name={first?.name ?? order.number}
        photoUrl={first ? (photos?.get(first.itemId)?.photoUrl ?? null) : null}
        category={(first && photos?.get(first.itemId)?.category) || 'goods'}
        size="sm"
        decorative
        eager
        dim={muted}
        className="row-span-2 size-14 self-start rounded-(--thumb-radius) lg:row-span-1 lg:self-center"
      />

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
        {/* The buyer's name gives way last: "via ..." truncates first. */}
        <p className="flex min-w-0 gap-1 text-sm text-ink-muted">
          <span className="max-w-full shrink-0 truncate font-medium text-ink-soft">{buyerLabel(order)}</span>
          <span className="min-w-0 truncate"> · via {agentLabel(order.agentName)}</span>
        </p>
      </div>

      {/* The total with its time under it, in a column of its own: the time is never truncated. */}
      <div className="flex flex-col items-end text-right lg:order-4">
        <p className={cx('type-price font-bold whitespace-nowrap', muted && 'text-ink-muted line-through decoration-1')}>
          <span className="sr-only">Total </span>
          {formatUSD(order.totalCents)}
        </p>
        <LocalTime iso={order.paidAt ?? order.createdAt} className="type-meta whitespace-nowrap text-ink-muted" />
      </div>

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
    </Pressable>
  );
}
