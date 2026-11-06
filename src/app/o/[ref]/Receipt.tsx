'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { StatusSwap } from '@/components/motion/status-swap';
import { isPayPalApprovalUrl } from '@/components/shop/activity-format';
import { formatUSD } from '@/lib/domain/money';
import { keepsPolling, statusView, type Tone, type Tracking } from './receipt-status';
import './receipt-motion.css';
import { goingToText, paidToText, type ReceiptOrder } from '@/lib/orders/receipt-types';

const POLL_MS = 3000;

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-sunken text-ink-soft',
};

const DOT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-error',
  info: 'text-info',
  neutral: 'text-ink-muted',
};

/** The status word on the summary panel (the page heading says it in full, so this copy is hidden from screen readers). */
const SHORT: Record<ReceiptOrder['status'], string> = {
  awaiting_approval: 'Not paid yet',
  approved: 'Confirming',
  payment_pending: 'Pending',
  paid: 'Paid',
  fulfilled: 'Paid',
  failed: 'Not paid',
  cancelled: 'Cancelled',
  expired: 'Expired',
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
          {/* Keyed by the state, so a change (Waiting → Paid) pops the new icon in again. */}
          <span key={view.title} className={cx('rc-pop inline-flex size-14 items-center justify-center rounded-full', TONE[view.tone])}>
            <Icon icon={view.icon} size="lg" className={cx(view.spin && 'animate-spin')} />
          </span>
          <h1 className="rc-rise type-display" style={{ '--rc-delay': '60ms' } as CSSProperties}>
            <StatusSwap value={view.title}>{view.title}</StatusSwap>
          </h1>
          <p className="rc-rise type-lead text-ink-soft" style={{ '--rc-delay': '120ms' } as CSSProperties}>
            <StatusSwap value={view.body}>{view.body}</StatusSwap>
          </p>
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
              <ButtonLink href={`${shopHref}?assistant=1`} variant={approvalUrl ? 'ghost' : 'secondary'}>
                Back to the assistant
              </ButtonLink>
            )}
          </div>
          {open && <p className="type-meta text-ink-muted">This page updates by itself.</p>}
        </div>
      </div>

      {/* The order summary: a plain panel, like a store's order confirmation. Status as a dot and a word. */}
      <Card as="section" aria-labelledby="receipt-title" tone="sunken" padding="lg" className="flex flex-col gap-5 lg:mt-2">
        <div className="flex flex-col gap-1">
          <h2 id="receipt-title" className="type-heading [overflow-wrap:anywhere]">
            {order.shopName}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="type-figures">Order {order.number}</span>
            <span aria-hidden="true" className={cx('inline-flex items-center gap-1.5 font-semibold', DOT[view.tone])}>
              <span className="size-2 rounded-full bg-current" />
              <StatusSwap value={view.tone === 'danger' ? 'Not paid' : SHORT[order.status]}>
                {view.tone === 'danger' ? 'Not paid' : SHORT[order.status]}
              </StatusSwap>
            </span>
          </p>
        </div>
        <dl className="type-receipt flex flex-col gap-2 border-t border-line pt-4 text-base">
          {order.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-4">
              <dt className="min-w-0 [overflow-wrap:anywhere]">
                <span className="font-semibold">{l.qty} ×</span> {l.name}
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
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd>{formatUSD(order.totalCents)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-ink-soft">
          {/* Whose PayPal account was paid (spec §8a): the shop's own, with its email masked, or Shelfie's demo account.
              While PayPal still holds the payment, where it is going instead (it isn't paid yet). */}
          {order.paidTo && <p className="font-semibold text-ink [overflow-wrap:anywhere]">{paidToText(order.paidTo)}</p>}
          {order.goingTo && <p className="font-semibold text-ink [overflow-wrap:anywhere]">{goingToText(order.goingTo)}</p>}
          <p>
            {order.fulfillment === 'shipping'
              ? 'Shipping to the address you gave PayPal.'
              : `Pickup${pickupNotes ? `: ${pickupNotes}` : ''}`}
          </p>
        </div>
      </Card>
    </div>
  );
}
