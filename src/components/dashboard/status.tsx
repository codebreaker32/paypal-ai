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
import type { BadgeTone } from '@/components/ui/Badge';
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

const DOT_TONE: Record<BadgeTone, string> = {
  neutral: 'text-ink-muted',
  accent: 'text-accent-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
};

/** Status as a coloured dot and the word, no box: `sm` in list rows, `md` beside a page title. */
export function OrderStatusText({
  order,
  size = 'sm',
  className,
}: {
  order: Pick<Order, 'status' | 'fulfillment' | 'captureRefused'>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const m = orderStatusMeta(order);
  return (
    <span className={cx('inline-flex items-center gap-2 font-semibold', size === 'md' ? 'text-lg' : 'text-sm', DOT_TONE[m.tone], className)}>
      <span aria-hidden="true" className={cx('shrink-0 rounded-full bg-current', size === 'md' ? 'size-2.5' : 'size-2')} />
      {m.label}
    </span>
  );
}
