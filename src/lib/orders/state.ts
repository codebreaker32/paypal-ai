// Pure order state machine. No I/O: the service applies the result with compare-and-set.
import type { OrderEvent, OrderStatus } from '@/lib/domain/types';

export type OrderEffect = 'capture' | 'brief';
export type TransitionResult = { next: OrderStatus; effects: OrderEffect[] } | { ignored: true };

export class InvalidTransition extends Error {
  constructor(
    public readonly from: OrderStatus | null,
    public readonly event: OrderEvent,
  ) {
    super(`Order event "${event}" is not allowed when the order is ${from ?? 'new'}`);
    this.name = 'InvalidTransition';
  }
}

type From = OrderStatus | 'new';

const ALLOWED: Partial<Record<From, Partial<Record<OrderEvent, { next: OrderStatus; effects: OrderEffect[] }>>>> = {
  new: { created: { next: 'awaiting_approval', effects: [] } },
  awaiting_approval: {
    paypal_approved: { next: 'approved', effects: ['capture'] },
    cancelled: { next: 'cancelled', effects: [] },
    expired: { next: 'expired', effects: [] },
  },
  approved: {
    capture_completed: { next: 'paid', effects: ['brief'] },
    capture_pending: { next: 'payment_pending', effects: [] },
    capture_declined: { next: 'awaiting_approval', effects: [] },
    // PayPal shows the order COMPLETED with a DECLINED/FAILED capture: final.
    capture_denied: { next: 'failed', effects: [] },
    mismatch: { next: 'failed', effects: [] },
    // PayPal refused the capture (non-transient 4xx) and then voided/dropped the order, or the order's window passed.
    capture_refused: { next: 'failed', effects: [] },
  },
  payment_pending: {
    capture_completed: { next: 'paid', effects: ['brief'] },
    capture_denied: { next: 'failed', effects: [] },
  },
  paid: { fulfilled: { next: 'fulfilled', effects: [] } },
};

/** Repeated or late events: the order already went through them, so they are logged and ignored. */
const IGNORED: Partial<Record<OrderStatus, OrderEvent[]>> = {
  awaiting_approval: ['created'],
  approved: ['paypal_approved'],
  payment_pending: ['paypal_approved', 'capture_pending'],
  paid: ['paypal_approved', 'capture_completed', 'capture_pending'],
  fulfilled: ['paypal_approved', 'capture_completed', 'capture_pending', 'fulfilled'],
  failed: ['mismatch', 'capture_denied', 'capture_refused'],
  cancelled: ['cancelled'],
  expired: ['expired'],
};

export function transition(status: OrderStatus | null, event: OrderEvent): TransitionResult {
  const hit = ALLOWED[status ?? 'new']?.[event];
  if (hit) return { next: hit.next, effects: [...hit.effects] };
  if (status && IGNORED[status]?.includes(event)) return { ignored: true };
  throw new InvalidTransition(status, event);
}

/** Orders that no PayPal event can move any more (other than `paid` → `fulfilled` by the seller). */
export const SETTLED_STATUSES: readonly OrderStatus[] = ['paid', 'fulfilled', 'failed', 'cancelled', 'expired'];
export const OPEN_STATUSES: readonly OrderStatus[] = ['awaiting_approval', 'approved', 'payment_pending'];

export const isOpen = (s: OrderStatus): boolean => OPEN_STATUSES.includes(s);
