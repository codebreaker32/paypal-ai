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
      <div className="flex flex-col gap-2 border-l-2 border-line-strong pl-3">
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
    <div className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3">
      <p className="flex items-center gap-1.5 type-meta font-semibold text-ink-muted">
        <Icon icon={order.briefSource === 'agent' ? Sparkles : Info} size="sm" />
        {order.briefSource === 'agent' ? 'AI brief' : 'Summary'}
      </p>
      <p className="text-sm font-semibold">{order.brief.headline}</p>
      {warns[0] && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-warn">
          <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
          <span>
            {warns[0].text}
            {warns.length > 1 && <span className="text-ink-muted"> (+{warns.length - 1} more)</span>}
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
      tone={muted ? 'flat' : 'raised'}
      data-order={order.number}
      className={cx(
        'relative flex flex-col gap-3 p-4 sm:p-5',
        muted && 'bg-surface text-ink-soft',
        fresh && 'animate-rise-in motion-reduce:animate-none',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="type-price font-semibold">
            <Link
              href={href}
              data-stretched-link
              className={cx(
                'underline-offset-4 hover:underline focus-visible:outline-none',
                'after:absolute after:inset-0 after:rounded-(--card-radius) after:content-[""]',
                'focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus',
              )}
            >
              {order.number}
            </Link>
          </h3>
          <p className="type-meta text-ink-muted">
            {buyerLabel(order)} · via {agentLabel(order.agentName)} · <LocalTime iso={order.paidAt ?? order.createdAt} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cx('type-price text-lg font-semibold', muted && 'text-ink-muted line-through decoration-1')}>
            {formatUSD(order.totalCents)}
          </span>
          <OrderStatusBadge order={order} />
        </div>
      </div>

      <p className={cx('text-sm', muted ? 'text-ink-muted' : 'text-ink-soft')}>{itemSummary(order.lines)}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon icon={ships ? (order.shipTo?.city ? MapPin : Truck) : Store} size="sm" className="text-ink-muted" />
        {whereLabel(order)}
      </p>

      <BriefPreview order={order} />

      {order.status === 'awaiting_approval' && (
        <p className="type-meta text-ink-muted">
          The buyer hasn&apos;t approved on PayPal yet. The link expires at <LocalTime iso={order.expiresAt} />.
        </p>
      )}

      {order.status === 'paid' && (
        <div className="relative z-10 mt-auto pt-1">
          {ships ? (
            <ButtonLink href={`${href}#tracking`} variant="secondary" icon={Truck} className="w-full sm:w-auto">
              Add tracking
            </ButtonLink>
          ) : (
            <MarkPickedUpButton shopId={shopId} order={order} onDone={onChange} />
          )}
        </div>
      )}
    </Card>
  );
}
