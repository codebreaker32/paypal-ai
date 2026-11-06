import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  PackageCheck,
  TimerOff,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { Order } from '@/lib/domain/types';
import { cx } from '@/components/ui/cx';

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  icon: LucideIcon;
}

/** Seller words for each order status: always an icon and a word, never colour alone. */
export function orderStatusMeta(order: Pick<Order, 'status' | 'fulfillment' | 'captureRefused'>): StatusMeta {
  switch (order.status) {
    case 'awaiting_approval':
      return { label: 'Waiting for approval', tone: 'warn', icon: Clock };
    case 'approved':
      return order.captureRefused
        ? { label: 'PayPal refused payment', tone: 'danger', icon: CircleX }
        : { label: 'Approved, taking payment', tone: 'info', icon: Hourglass };
    case 'payment_pending':
      return { label: 'Payment pending', tone: 'warn', icon: Hourglass };
    case 'paid':
      return { label: 'Paid', tone: 'ok', icon: CircleCheck };
    case 'fulfilled':
      return order.fulfillment === 'pickup'
        ? { label: 'Picked up', tone: 'info', icon: PackageCheck }
        : { label: 'Shipped', tone: 'info', icon: Truck };
    case 'failed':
      return { label: 'Payment failed', tone: 'danger', icon: CircleX };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral', icon: Ban };
    case 'expired':
      return { label: 'Expired', tone: 'neutral', icon: TimerOff };
  }
}

export function OrderStatusBadge({ order, className }: { order: Pick<Order, 'status' | 'fulfillment' | 'captureRefused'>; className?: string }) {
  const m = orderStatusMeta(order);
  return (
    <Badge tone={m.tone} icon={m.icon} className={className}>
      {m.label}
    </Badge>
  );
}

const DOT_TONE: Record<BadgeTone, string> = {
  neutral: 'text-ink-muted',
  accent: 'text-accent-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
};

/** Status in a list row: a coloured dot and the word, no box. */
export function OrderStatusText({ order, className }: { order: Pick<Order, 'status' | 'fulfillment' | 'captureRefused'>; className?: string }) {
  const m = orderStatusMeta(order);
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-semibold', DOT_TONE[m.tone], className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {m.label}
    </span>
  );
}
