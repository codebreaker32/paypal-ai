'use client';

import Link from 'next/link';
import { Info, Loader2, MapPin, Sparkles, Store, TriangleAlert, Truck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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

/** The brief on a card that still needs the seller (paid). Done cards stay compact. */
function BriefPreview({ order }: { order: Order }) {
  if (order.status !== 'paid') return null;
  if (!order.brief) {
    return (
      <div className="flex flex-col gap-2 rounded-xs bg-accent-soft px-3 py-2.5">
        <p className="flex items-center gap-1.5 type-meta font-semibold text-ink-soft">
          <Icon icon={Loader2} size="sm" className="animate-spin" />
          Writing the brief…
        </p>
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }
  const warns = order.brief.flags.filter((f) => f.severity === 'warn');
  return (
    <div className="flex flex-col gap-1.5 rounded-xs bg-accent-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 type-meta font-semibold text-ink-soft">
        <Icon icon={order.briefSource === 'agent' ? Sparkles : Info} size="sm" />
        {order.briefSource === 'agent' ? 'AI brief' : 'Summary'}
      </p>
      <p className="text-sm font-semibold">{order.brief.headline}</p>
      {warns[0] && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-warn">
          <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
          <span>
            {warns[0].text}
            {warns.length > 1 && <span className="text-ink-soft"> (+{warns.length - 1} more)</span>}
          </span>
        </p>
      )}
    </div>
  );
}

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
    <Card
      as="li"
      padding="none"
      tone="flat"
      data-order={order.number}
      className={cx(
        'perforated relative flex flex-col gap-3 px-4 pt-4 sm:px-5 sm:pt-5',
        muted && 'bg-surface text-ink-soft',
        fresh && 'animate-rise-in motion-reduce:animate-none',
      )}
    >
      {/* Phone: the number with its total beside it (money before the brief), meta below, then the badge.
          Wider: badge to the right, and the total only on the footer line. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex w-full min-w-0 flex-col gap-0.5 sm:w-auto">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="type-receipt text-base font-semibold whitespace-nowrap">
              <Link
                href={href}
                data-stretched-link
                className={cx(
                  'underline-offset-4 hover:underline focus-visible:outline-none',
                  'after:absolute after:inset-0 after:content-[""]',
                  'focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-focus',
                )}
              >
                {order.number}
              </Link>
            </h3>
            {/* Repeats the footer's Total for the eye; screen readers hear it once, on the footer line. */}
            <span aria-hidden="true" className={cx('type-receipt text-lg leading-6 font-semibold whitespace-nowrap sm:hidden', muted && 'text-ink-muted line-through decoration-1')}>
              {formatUSD(order.totalCents)}
            </span>
          </div>
          <p className="type-meta text-ink-muted">
            {buyerLabel(order)} · via {agentLabel(order.agentName)} · <LocalTime iso={order.paidAt ?? order.createdAt} />
          </p>
        </div>
        <OrderStatusBadge order={order} className="shrink-0 sm:mt-0.5" />
      </div>

      <p className={cx('rule-dashed pt-3 text-sm', muted ? 'text-ink-muted' : 'text-ink')}>{itemSummary(order.lines)}</p>
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

      <div className="rule-dashed mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-3">
        <p className="flex items-baseline gap-3">
          <span className="type-meta font-semibold text-ink-muted">Total</span>
          <span className={cx('type-receipt text-xl leading-7 font-semibold', muted && 'text-ink-muted line-through decoration-1')}>
            {formatUSD(order.totalCents)}
          </span>
        </p>
        {order.status === 'paid' && (
          <div className="relative z-10 w-full sm:w-auto">
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
    </Card>
  );
}
