'use client';

import Link from 'next/link';
import { Info, Loader2, MapPin, Sparkles, Store, TriangleAlert, Truck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { Order } from '@/lib/domain/types';
import { agentLabel, buyerLabel, itemSummary, whereLabel } from '@/lib/seller/view';
import { LocalTime } from './LocalTime';
import { MarkPickedUpButton } from './MarkPickedUpButton';
import { OrderStatusBadge } from './status';

const MUTED = new Set<Order['status']>(['failed', 'cancelled', 'expired']);

/**
 * Ledger columns from lg up: order | items and delivery | status | amount. Shared with the column head in
 * OrdersPanel so the head and every row line up.
 */
export const LEDGER_COLUMNS = 'lg:grid-cols-[13rem_minmax(0,1fr)_13rem_7rem] lg:gap-x-6';

/** Phones: reference and amount on one line, then the stamp, then the detail. Desktop: four columns. */
const ROW_AREAS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 [grid-template-areas:'ref_amt'_'status_status'_'body_body'] " +
  "lg:[grid-template-areas:'ref_body_status_amt']";

/** The brief on a row that still needs the seller (paid). Done rows stay compact. */
function BriefPreview({ order }: { order: Order }) {
  if (order.status !== 'paid') return null;
  if (!order.brief) {
    return (
      <div className="flex flex-col gap-2 border-l-2 border-accent pl-3">
        <p className="flex items-center gap-1.5 type-meta font-semibold text-ink-muted">
          <Icon icon={Loader2} size="sm" className="animate-spin" />
          Writing the brief…
        </p>
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }
  const warns = order.brief.flags.filter((f) => f.severity === 'warn');
  return (
    <div className="flex flex-col gap-1 border-l-2 border-accent pl-3">
      <p className="flex items-center gap-1.5 type-meta font-semibold text-accent-ink">
        <Icon icon={order.briefSource === 'agent' ? Sparkles : Info} size="sm" />
        {order.briefSource === 'agent' ? 'AI brief' : 'Summary'}
      </p>
      <p className="text-sm font-semibold">{order.brief.headline}</p>
      {warns[0] && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-warn">
          <Icon icon={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
          <span>
            {warns[0].text}
            {warns.length > 1 && <span className="text-ink-muted"> (+{warns.length - 1} more)</span>}
          </span>
        </p>
      )}
    </div>
  );
}

/** One order as a ledger row: reference, what and where, status stamp, amount. */
export function OrderCard({
  order,
  shopId,
  fresh,
  onChange,
}: {
  order: Order;
  shopId: string;
  fresh?: boolean;
  onChange: (order: Order) => void;
}) {
  const href = `/shops/${shopId}/orders/${order.id}`;
  const muted = MUTED.has(order.status);
  const ships = order.fulfillment === 'shipping';
  return (
    <li
      data-order={order.number}
      className={cx(
        'relative items-start px-4 py-4 transition-colors hover:bg-surface sm:px-5 lg:py-5',
        ROW_AREAS,
        LEDGER_COLUMNS,
        muted && 'text-ink-soft',
        fresh && 'animate-rise-in motion-reduce:animate-none',
      )}
    >
      {/* Order column: reference and who placed it. */}
      <div className="[grid-area:ref]">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="type-ref text-base whitespace-nowrap">
            <Link
              href={href}
              data-stretched-link
              className={cx(
                'underline-offset-4 hover:underline focus-visible:outline-none',
                'after:absolute after:inset-0 after:content-[""]',
                'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus',
              )}
            >
              {order.number}
            </Link>
          </h3>
          <p className="type-meta text-ink-muted">
            {buyerLabel(order)}, via {agentLabel(order.agentName)}
            <br />
            <LocalTime iso={order.paidAt ?? order.createdAt} />
          </p>
        </div>
      </div>

      {/* Items and delivery, with the brief and the next step for paid orders. */}
      <div className="flex min-w-0 flex-col gap-2.5 [grid-area:body]">
        <p className={cx('text-sm', muted ? 'text-ink-muted' : 'text-ink')}>{itemSummary(order.lines)}</p>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon icon={ships ? (order.shipTo?.city ? MapPin : Truck) : Store} size="sm" className="text-ink-muted" />
          {whereLabel(order)}
        </p>

        <BriefPreview order={order} />

        {order.status === 'awaiting_approval' && (
          <p className="type-meta text-ink-muted">
            The buyer hasn’t approved on PayPal yet. The link expires at <LocalTime iso={order.expiresAt} />.
          </p>
        )}

        {order.status === 'paid' && (
          <div className="relative z-10 pt-1">
            {ships ? (
              <ButtonLink href={`${href}#tracking`} variant="secondary" icon={Truck} className="w-full sm:w-auto">
                Add tracking
              </ButtonLink>
            ) : (
              <MarkPickedUpButton shopId={shopId} order={order} onDone={onChange} />
            )}
          </div>
        )}
      </div>

      <div className="[grid-area:status] lg:pt-0.5">
        <OrderStatusBadge order={order} />
      </div>

      <div className="text-right [grid-area:amt]">
        <span className={cx('type-amount text-lg', muted && 'text-ink-muted line-through decoration-1')}>
          {formatUSD(order.totalCents)}
        </span>
      </div>
    </li>
  );
}
