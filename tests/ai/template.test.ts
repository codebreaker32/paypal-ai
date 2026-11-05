// The template brief fallback and the stale-brief rule that stops "Writing the brief…" from spinning forever.
import { describe, expect, it } from 'vitest';
import type { Order } from '@/lib/domain/types';
import { briefIsStale, templateBrief, withFallbackBrief } from '@/lib/ai/template';

const paid: Order = {
  id: 'ord_1', number: 'SHF-AAAAAA', shopId: 'shp_1', status: 'paid', fulfillment: 'shipping', buyerName: null, buyerNote: null,
  agentName: 'Claude', clientRequestId: null, itemsCents: 900, shippingCents: 800, totalCents: 1700, paypalOrderId: 'PP1',
  approvalUrl: 'https://x', expiresAt: '2026-11-06T19:00:00.000Z', captureClaimedAt: null, captureId: 'CAP1', payerName: null,
  payerEmail: null, shipTo: null, brief: null, briefSource: null, paidAt: '2026-11-06T18:05:00.000Z', fulfilledAt: null,
  lastCheckedAt: null, createdAt: '2026-11-06T18:00:00.000Z', updatedAt: '2026-11-06T18:05:00.000Z',
  lines: [{ itemId: 'i1', variantId: 'v1', name: 'Loaf', label: 'Large', unitCents: 900, qty: 1, paypalProductId: null }],
};
const paidAt = Date.parse(paid.paidAt!);

describe('stale brief fallback', () => {
  it('keeps waiting for a recent paid order', () => {
    expect(briefIsStale(paid, paidAt + 60_000)).toBe(false);
    expect(withFallbackBrief(paid, paidAt + 60_000)).toBe(paid);
  });
  it('after two minutes with no brief, shows the labelled template', () => {
    const shown = withFallbackBrief(paid, paidAt + 3 * 60_000);
    expect(shown.briefSource).toBe('template');
    expect(shown.brief).toEqual(templateBrief(paid));
    expect(shown.brief!.prep_list[0].text).toBe('Loaf (Large)');
  });
  it('never replaces a stored brief or touches unpaid orders', () => {
    const stored = { ...paid, brief: templateBrief(paid), briefSource: 'agent' as const };
    expect(withFallbackBrief(stored, paidAt + 3_600_000)).toBe(stored);
    const open = { ...paid, status: 'awaiting_approval' as const, paidAt: null };
    expect(briefIsStale(open, paidAt + 3_600_000)).toBe(false);
  });
});
