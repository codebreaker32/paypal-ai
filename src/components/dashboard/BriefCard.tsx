import { Info, Loader2, MessageSquareQuote, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import type { Order, OrderBrief } from '@/lib/domain/types';

const REQUEST_KIND: Record<OrderBrief['buyer_requests'][number]['kind'], string> = {
  allergy: 'Allergy',
  timing: 'Timing',
  inscription: 'Inscription',
  other: 'Request',
};

function BuyerNote({ note }: { note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 type-label text-ink-muted">
        <Icon icon={MessageSquareQuote} size="sm" />
        Buyer’s note, as written
      </h3>
      <blockquote className="rounded-md bg-surface px-3 py-2.5 text-sm whitespace-pre-line [overflow-wrap:anywhere]">{note}</blockquote>
    </div>
  );
}

/** The AI brief (spec §4 Order detail): generating / ready / fallback (labelled). Server-safe. */
export function BriefCard({ order, className }: { order: Order; className?: string }) {
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  const brief = order.brief;

  return (
    <Card as="section" tone="note" aria-labelledby="brief-title" padding="lg" className={cx('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="brief-title" className="flex items-center gap-2 type-label text-note">
          <Icon icon={brief && order.briefSource === 'template' ? Info : Sparkles} size="sm" />
          {brief && order.briefSource === 'template' ? 'Order summary' : 'AI brief by Claude'}
        </h2>
        {brief && order.briefSource === 'template' && <Badge>Basic summary</Badge>}
      </div>

      {!brief && paid && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <p className="flex items-center gap-2 type-heading">
            <Icon icon={Loader2} className="animate-spin text-ink-muted" />
            Writing the brief…
          </p>
          <p className="text-sm text-ink-muted">Claude is reading PayPal’s record. About 10 seconds.</p>
        </div>
      )}

      {!brief && !paid && (
        <p className="text-ink-soft">The brief is written as soon as the payment is received.</p>
      )}

      {brief && (
        <>
          <p className="type-heading" data-testid="brief-headline">
            {brief.headline}
          </p>
          {order.briefSource === 'template' && (
            <p className="type-meta -mt-2 text-ink-muted">The AI brief wasn’t available, so this is a plain summary.</p>
          )}

          {brief.flags.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Things to notice">
              {brief.flags.map((f, i) =>
                f.severity === 'warn' ? (
                  // A heads-up inside a helpful note: a white callout in ink, only its icon in the warn ochre. Never the error red.
                  <li key={i} className="flex items-start gap-2 rounded-md bg-surface px-3 py-2.5 font-medium text-note-ink shadow-xs">
                    <Icon icon={TriangleAlert} className="mt-0.5 text-warn" />
                    <span>
                      <span className="sr-only">Warning: </span>
                      {f.text}
                    </span>
                  </li>
                ) : (
                  <li key={i} className="flex items-start gap-2 px-1 text-sm text-info">
                    <Icon icon={Info} size="sm" className="mt-0.5" />
                    <span>{f.text}</span>
                  </li>
                ),
              )}
            </ul>
          )}

          {brief.prep_list.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="type-label text-ink-muted">{order.fulfillment === 'shipping' ? 'Pack' : 'Prepare'}</h3>
              <ul className="flex flex-col divide-y divide-line">
                {brief.prep_list.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-2">
                    <span className="type-price w-8 shrink-0 text-right font-semibold">{p.qty !== null ? `${p.qty} ×` : '•'}</span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.buyer_requests.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="type-label text-ink-muted">Buyer asks</h3>
              <ul className="flex flex-col gap-1.5">
                {brief.buyer_requests.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <Badge tone={r.kind === 'allergy' ? 'note' : 'neutral'} className="bg-surface">{REQUEST_KIND[r.kind]}</Badge>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {order.buyerNote && <BuyerNote note={order.buyerNote} />}
    </Card>
  );
}
