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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-start lg:gap-16">
      <div className="flex flex-col gap-8">
        <div aria-live="polite" className="flex flex-col items-start gap-4">
          <span className={cx('inline-flex size-14 items-center justify-center rounded-full border-2 border-current', TONE[view.tone])}>
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
      </div>

      {/* The printed slip: a till receipt with a torn, perforated foot */}
      <div className="paper-drop relative lg:mt-2">
        <Card
          as="section"
          aria-labelledby="receipt-title"
          tone="flat"
          padding="none"
          className="perforated relative flex flex-col gap-4 border-0 px-5 pt-6 sm:px-7 sm:pt-7"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 id="receipt-title" className="type-title [overflow-wrap:anywhere]">
              {order.shopName}
            </h2>
            <span className="type-receipt text-ink-muted">Order {order.number}</span>
            {(order.status === 'paid' || order.status === 'fulfilled') && (
              // A rubber stamp on the slip; the page heading already says it in words.
              <span
                aria-hidden="true"
                className="mt-2 -rotate-6 rounded-xs border-[3px] border-ok px-3 font-display text-2xl leading-9 font-extrabold tracking-wide text-ok uppercase"
              >
                Paid
              </span>
            )}
          </div>
          <dl className="type-receipt rule-dashed flex flex-col gap-1.5 pt-4">
            {order.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-4">
                <dt className="min-w-0 [overflow-wrap:anywhere]">
                  {l.qty} × {l.name}
                  {l.label ? ` (${l.label})` : ''}
                </dt>
                <dd className="shrink-0">{formatUSD(l.unitCents * l.qty)}</dd>
              </div>
            ))}
            {order.shippingCents > 0 && (
              <div className="flex justify-between gap-4 text-ink-soft">
                <dt>Shipping</dt>
                <dd>{formatUSD(order.shippingCents)}</dd>
              </div>
            )}
            <div className="rule-dashed mt-3 flex items-baseline justify-between gap-4 pt-3 text-lg font-semibold">
              <dt>Total</dt>
              <dd>{formatUSD(order.totalCents)}</dd>
            </div>
          </dl>
          <p className="rule-dashed pt-3 text-center type-meta text-ink-muted">
            {order.fulfillment === 'shipping'
              ? 'Shipping to the address you gave PayPal.'
              : `Pickup${pickupNotes ? `: ${pickupNotes}` : ''}`}
          </p>
        </Card>
      </div>
    </div>
  );
}
