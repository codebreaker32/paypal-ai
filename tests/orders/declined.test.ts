// One "card declined" rule for the receipt, the seller's order detail and get_order_status.
import { describe, expect, it } from 'vitest';
import type { OrderEventRow } from '@/lib/domain/types';
import { cardDeclined } from '@/lib/orders/declined';

const ev = (type: string, detail: unknown = null): OrderEventRow => ({
  id: `evt_${type}`, orderId: 'ord_1', type, source: 'poller', detail, createdAt: '2026-11-06T18:00:00.000Z',
});

describe('cardDeclined', () => {
  it('is true only while the order waits for approval after a capture_declined that was not ignored', () => {
    const declined = [ev('created'), ev('paypal_approved'), ev('capture_declined', { issue: 'INSTRUMENT_DECLINED' })];
    expect(cardDeclined({ status: 'awaiting_approval' }, declined)).toBe(true);
    expect(cardDeclined({ status: 'awaiting_approval' }, [ev('capture_declined', null)])).toBe(true);
    expect(cardDeclined({ status: 'awaiting_approval' }, [ev('created'), ev('capture_declined', { ignored: true })])).toBe(false);
    expect(cardDeclined({ status: 'awaiting_approval' }, [ev('created'), ev('capture_error')])).toBe(false);
    expect(cardDeclined({ status: 'approved' }, declined)).toBe(false);
    expect(cardDeclined({ status: 'paid' }, declined)).toBe(false);
  });
});
