import { describe, expect, it } from 'vitest';
import { InvalidTransition, transition } from '@/lib/orders/state';
import type { OrderEvent, OrderStatus } from '@/lib/domain/types';

const STATUSES: (OrderStatus | null)[] = [
  null, 'awaiting_approval', 'approved', 'paid', 'payment_pending', 'failed', 'cancelled', 'expired', 'fulfilled',
];
const EVENTS: OrderEvent[] = [
  'created', 'paypal_approved', 'capture_completed', 'capture_pending', 'capture_declined', 'capture_denied',
  'mismatch', 'cancelled', 'expired', 'fulfilled', 'capture_refused',
];

// Spec §7, row by row.
const ALLOWED: [OrderStatus | null, OrderEvent, OrderStatus, ('capture' | 'brief')[]][] = [
  [null, 'created', 'awaiting_approval', []],
  ['awaiting_approval', 'paypal_approved', 'approved', ['capture']],
  ['approved', 'capture_completed', 'paid', ['brief']],
  ['approved', 'capture_pending', 'payment_pending', []],
  ['payment_pending', 'capture_completed', 'paid', ['brief']],
  ['payment_pending', 'capture_denied', 'failed', []],
  ['approved', 'capture_declined', 'awaiting_approval', []],
  // Coordinator ruling (fix round 1): a COMPLETED PayPal order whose capture is DECLINED/FAILED is final.
  ['approved', 'capture_denied', 'failed', []],
  ['approved', 'mismatch', 'failed', []],
  // R3: a refused capture is final once PayPal voids/drops the order or its window passes.
  ['approved', 'capture_refused', 'failed', []],
  ['awaiting_approval', 'cancelled', 'cancelled', []],
  ['awaiting_approval', 'expired', 'expired', []],
  ['paid', 'fulfilled', 'fulfilled', []],
];

// Repeated or late events that are logged and ignored (never an error, never a state change).
const IGNORED: [OrderStatus, OrderEvent][] = [
  ['awaiting_approval', 'created'],
  ['approved', 'paypal_approved'],
  ['payment_pending', 'paypal_approved'],
  ['payment_pending', 'capture_pending'],
  ['paid', 'paypal_approved'],
  ['paid', 'capture_completed'],
  ['paid', 'capture_pending'],
  ['fulfilled', 'paypal_approved'],
  ['fulfilled', 'capture_completed'],
  ['fulfilled', 'capture_pending'],
  ['fulfilled', 'fulfilled'],
  ['failed', 'mismatch'],
  ['failed', 'capture_denied'],
  ['failed', 'capture_refused'],
  ['cancelled', 'cancelled'],
  ['expired', 'expired'],
];

describe('order state machine', () => {
  it.each(ALLOWED)('%s + %s → %s', (from, event, next, effects) => {
    expect(transition(from, event)).toEqual({ next, effects });
  });

  it.each(IGNORED)('%s + %s is ignored', (from, event) => {
    expect(transition(from, event)).toEqual({ ignored: true });
  });

  it('a capture reported again on a paid order is ignored (webhook after the return URL)', () => {
    expect(transition('paid', 'capture_completed')).toEqual({ ignored: true });
  });

  it('every other (status, event) pair throws InvalidTransition', () => {
    const allowed = new Set(ALLOWED.map(([s, e]) => `${s}|${e}`));
    const ignored = new Set(IGNORED.map(([s, e]) => `${s}|${e}`));
    let forbidden = 0;
    for (const s of STATUSES) {
      for (const e of EVENTS) {
        const key = `${s}|${e}`;
        if (allowed.has(key) || ignored.has(key)) continue;
        forbidden++;
        expect(() => transition(s, e), key).toThrow(InvalidTransition);
      }
    }
    expect(forbidden).toBe(STATUSES.length * EVENTS.length - ALLOWED.length - IGNORED.length);
  });

  it('never captures an expired or cancelled order', () => {
    expect(() => transition('expired', 'paypal_approved')).toThrow(InvalidTransition);
    expect(() => transition('cancelled', 'paypal_approved')).toThrow(InvalidTransition);
    expect(() => transition('expired', 'capture_completed')).toThrow(InvalidTransition);
  });

  it('InvalidTransition names the status and the event', () => {
    try {
      transition('cancelled', 'fulfilled');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransition);
      expect((e as InvalidTransition).from).toBe('cancelled');
      expect((e as InvalidTransition).event).toBe('fulfilled');
      expect((e as Error).message).toContain('cancelled');
    }
  });
});
