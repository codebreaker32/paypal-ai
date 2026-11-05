'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Bot } from 'lucide-react';
import { ButtonLink, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { isPayPalApprovalUrl } from '@/components/shop/activity-format';
import { formatUSD } from '@/lib/domain/money';
import { keepsPolling, statusView, type Tone, type Tracking } from './receipt-status';
import type { ReceiptOrder } from '@/lib/orders/receipt-types';

const POLL_MS = 3000;

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-sunken text-ink-soft',
};

export interface ReceiptProps {
  orderRef: string;
  initial: ReceiptOrder;
  pickupNotes: string;
  /** The order came from the shop page's assistant: offer the way back to it. */
  fromAssistant: boolean;
  tracking: Tracking | null;
}

export function Receipt({ orderRef, initial, pickupNotes, fromAssistant, tracking }: ReceiptProps) {
  const [order, setOrder] = useState(initial);
  const open = keepsPolling(order);

  // While PayPal is still deciding, re-read our own record every 3 s (the return URL and the poller do the PayPal sync).
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderRef)}`, { cache: 'no-store' });
        if (res.ok && !stopped) setOrder(((await res.json()) as { order: ReceiptOrder }).order);
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [open, orderRef]);

  const view = statusView(order, pickupNotes, tracking);
  const shopHref = `/s/${order.shopSlug}`;
  const approvalUrl = view.approve && order.approvalUrl && isPayPalApprovalUrl(order.approvalUrl) ? order.approvalUrl : null;

  return (
    <div className="flex flex-col gap-8">
      <div aria-live="polite" className="flex flex-col items-start gap-4">
        <span className={cx('inline-flex size-12 items-center justify-center rounded-md', TONE[view.tone])}>
          <Icon icon={view.icon} size="lg" className={cx(view.spin && 'animate-spin')} />
        </span>
        <h1 className="type-display">{view.title}</h1>
        <p className="type-lead text-ink-soft">{view.body}</p>
      </div>

      <div className="flex flex-col gap-3">
        {approvalUrl && (
          <a href={approvalUrl} className={buttonClasses({ variant: 'paypal', size: 'lg', fullWidth: true })}>
            {view.approve}
          </a>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={shopHref} variant={approvalUrl ? 'secondary' : 'primary'} icon={ArrowLeft}>
            Back to shop
          </ButtonLink>
          {fromAssistant && (
            <ButtonLink href={`${shopHref}?assistant=1`} variant={approvalUrl ? 'ghost' : 'secondary'} icon={Bot}>
              Back to the assistant
            </ButtonLink>
          )}
        </div>
        {open && <p className="type-meta text-ink-muted">This page updates by itself.</p>}
      </div>

      <Card as="section" aria-labelledby="receipt-title" padding="none" className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-(--card-pad) py-3 sm:px-(--card-pad-lg)">
          <h2 id="receipt-title" className="type-heading">
            {order.shopName}
          </h2>
          <span className="type-meta text-ink-muted">
            Order <span className="type-ref text-ink">{order.number}</span>
          </span>
        </div>
        <dl className="type-price flex flex-col px-(--card-pad) pt-1 pb-(--card-pad) text-sm sm:px-(--card-pad-lg) sm:pb-(--card-pad-lg)">
          {order.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-4 border-b border-line py-2.5">
              <dt className="min-w-0 [overflow-wrap:anywhere]">
                <span className="inline-block min-w-7 font-semibold text-ink-soft">{l.qty} ×</span> {l.name}
                {l.label ? ` (${l.label})` : ''}
              </dt>
              <dd className="shrink-0">{formatUSD(l.unitCents * l.qty)}</dd>
            </div>
          ))}
          {order.shippingCents > 0 && (
            <div className="flex justify-between gap-4 border-b border-line py-2.5 text-ink-soft">
              <dt>Shipping</dt>
              <dd>{formatUSD(order.shippingCents)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="type-label">Total</dt>
            <dd className="type-amount rule-total pb-0.5 text-2xl">{formatUSD(order.totalCents)}</dd>
          </div>
        </dl>
        <p className="border-t border-line bg-surface-sunken px-(--card-pad) py-3 type-meta text-ink-soft sm:px-(--card-pad-lg)">
          {order.fulfillment === 'shipping'
            ? 'Shipping to the address on your PayPal account.'
            : `Pickup${pickupNotes ? `: ${pickupNotes}` : ''}`}
        </p>
      </Card>
    </div>
  );
}
