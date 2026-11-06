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
import type { BadgeTone } from '@/components/ui/badge';
import type { Order } from '@/lib/domain/types';
import { cx } from '@/components/ui/cx';
import { StatusSwap } from '@/components/motion/status-swap';

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  icon: LucideIcon;
}

/** Seller words for each order status: always an icon and a word, never colour alone. */
export function orderStatusMeta(order: Pick<Order, 'status' | 'fulfillment' | 'captureRefused'>): StatusMeta {
  switch (order.status) {
    case 'awaiting_approval':
      // A normal pending state, not a caution: neutral, so warn and error stay for the states that need the seller.
      return { label: 'Waiting for approval', tone: 'neutral', icon: Clock };
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
  danger: 'text-error',
  error: 'text-error',
  note: 'text-note',
  info: 'text-info',
};

/** Status as a coloured dot and the word, no box: `sm` in list rows, `md` beside a page title. A change crossfades. */
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
  // An error carries a cue beyond its colour: the status's own icon (a crossed circle) in place of the dot.
  const failed = m.tone === 'danger' || m.tone === 'error';
  return (
    <StatusSwap value={m.label} className={cx('font-semibold', size === 'md' ? 'text-lg' : 'text-sm', DOT_TONE[m.tone], className)}>
      <span className="inline-flex items-center gap-2">
        {failed ? (
          <m.icon aria-hidden="true" strokeWidth={2.5} className={cx('shrink-0', size === 'md' ? 'size-4.5' : 'size-3.5')} />
        ) : (
          <span aria-hidden="true" className={cx('shrink-0 rounded-full bg-current', size === 'md' ? 'size-2.5' : 'size-2')} />
        )}
        {m.label}
      </span>
    </StatusSwap>
  );
}
