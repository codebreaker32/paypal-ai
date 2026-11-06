// Order detail (spec §4): one order end to end. Owner only, SQLite only; refreshes itself while payment or the brief is pending.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CircleCheck, Mail, MapPin, Settings, Store, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { BriefCard } from '@/components/dashboard/BriefCard';
import { CopyButton } from '@/components/dashboard/CopyButton';
import { withFallbackBrief } from '@/lib/ai/template';
import { AutoRefresh, PickupAction } from '@/components/dashboard/DetailClient';
import { LocalTime } from '@/components/dashboard/LocalTime';
import { TrackingForm } from '@/components/dashboard/TrackingForm';
import { OrderStatusBadge } from '@/components/dashboard/status';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as ordersRepo from '@/lib/db/repos/orders';
import { formatUSD } from '@/lib/domain/money';
import { isDemoShop } from '@/lib/domain/payee';
import type { Order, Shop, Tracker } from '@/lib/domain/types';
import { isOpen } from '@/lib/orders/state';
import { actionWords, agentLabel, cancelledByShop, cardDeclined, heldForUnknownEmail, lineName, paypalCardWords, timelineEntries, type TimelineEntry } from '@/lib/seller/view';

export async function generateMetadata({ params }: PageProps<'/shops/[id]/orders/[orderId]'>): Promise<Metadata> {
  const { id, orderId } = await params;
  const shop = await getOwnedShop(id).catch(() => null);
  const order = shop ? ordersRepo.byId(getDb(), orderId) : null;
  return { title: order && order.shopId === shop?.id ? `Order ${order.number} · Shelfie` : 'Order · Shelfie', robots: { index: false } };
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="type-heading">
      {children}
    </h2>
  );
}

function ActionCard({
  shop, order, trackers, declined, byShop, held, className,
}: { shop: Shop; order: Order; trackers: Tracker[]; declined: boolean; byShop: boolean; held: boolean; className?: string }) {
  // Paid into the seller's own PayPal account: PayPal refuses Shelfie's tracker on it, so tracking is saved here (spec §8a).
  const sellerPaid = order.payeeEmail !== null;
  const body = (() => {
    if (order.status === 'paid' && order.fulfillment === 'pickup') {
      return (
        <>
          <SectionTitle id="action-title">Hand it over</SectionTitle>
          <p className="text-ink-soft">Payment is in. When the buyer collects the order, mark it picked up.</p>
          <PickupAction shopId={shop.id} order={order} />
        </>
      );
    }
    if (order.status === 'paid') {
      return (
        <>
          <SectionTitle id="action-title">Add tracking</SectionTitle>
          <p className="text-ink-soft">
            {sellerPaid
              ? 'Ship it to the address from PayPal, then add the tracking number here so the buyer’s assistant can read it back. Add it to this payment in your PayPal account too.'
              : 'Ship it to the address from PayPal, then add the tracking number. It goes to PayPal for the buyer, and their assistant can read it back.'}
          </p>
          <TrackingForm shopId={shop.id} orderId={order.id} atPayPal={!sellerPaid} />
        </>
      );
    }
    if (order.status === 'fulfilled') {
      return (
        <>
          <SectionTitle id="action-title">{order.fulfillment === 'pickup' ? 'Picked up' : 'Shipped'}</SectionTitle>
          {order.fulfilledAt && (
            <p className="text-ink-soft">
              Marked {order.fulfillment === 'pickup' ? 'picked up' : 'shipped'} at <LocalTime iso={order.fulfilledAt} />.
            </p>
          )}
          {trackers.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Tracking">
              {trackers.map((t) => (
                <li key={t.trackingNumber} className="flex flex-col gap-1 rounded-md bg-surface-sunken py-2 pr-1 pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pr-2">
                    <span className="font-semibold">{t.carrier}</span>
                    {t.paypalStatus !== null ? (
                      <Badge tone="ok" icon={CircleCheck}>
                        Sent to PayPal
                      </Badge>
                    ) : (
                      <Badge tone="info" icon={CircleCheck}>
                        Saved in Shelfie
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-price min-w-0 font-mono text-sm [overflow-wrap:anywhere]">{t.trackingNumber}</span>
                    <CopyButton text={t.trackingNumber} what="tracking number" iconOnly />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {trackers.some((t) => t.paypalStatus === null) && (
            <p className="type-meta text-ink-muted">
              PayPal only lets the account that was paid add tracking, so add it to this payment in your PayPal account too.
            </p>
          )}
        </>
      );
    }
    const [title, text] = actionWords(order, declined, byShop, held);
    return (
      <>
        <SectionTitle id="action-title">{title}</SectionTitle>
        <p className="text-ink-soft">{text}</p>
        {order.status === 'awaiting_approval' && (
          <p className="type-meta text-ink-muted">
            The PayPal link expires at <LocalTime iso={order.expiresAt} />.
          </p>
        )}
        {held && (
          <ButtonLink href={`/shops/${shop.id}?tab=settings`} variant="secondary" icon={Settings} className="w-full sm:w-auto sm:self-start">
            Check your PayPal email
          </ButtonLink>
        )}
      </>
    );
  })();
  return (
    <Card as="section" id="tracking" aria-labelledby="action-title" padding="lg" className={cx('flex scroll-mt-4 flex-col gap-3', className)}>
      {body}
    </Card>
  );
}

function BuyerCard({ shop, order, className }: { shop: Shop; order: Order; className?: string }) {
  const a = order.shipTo;
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  return (
    <Card as="section" aria-labelledby="buyer-title" padding="lg" className={cx('flex flex-col gap-4', className)}>
      <SectionTitle id="buyer-title">Buyer</SectionTitle>
      {order.payerName || order.payerEmail ? (
        <div className="flex flex-col gap-1">
          {order.payerName && <p className="font-semibold">{order.payerName}</p>}
          {order.payerEmail && (
            <a href={`mailto:${order.payerEmail}`} className="inline-flex min-h-tap items-center gap-1.5 self-start text-accent-ink underline underline-offset-4 [overflow-wrap:anywhere]">
              <Icon icon={Mail} size="sm" />
              {order.payerEmail}
            </a>
          )}
          <p className="type-meta text-ink-muted">From PayPal</p>
        </div>
      ) : (
        <p className="text-ink-soft">PayPal shares the buyer’s name{order.fulfillment === 'shipping' ? ' and address' : ''} once they approve.</p>
      )}
      {order.buyerName && order.buyerName !== order.payerName && (
        <p className="type-meta text-ink-muted">
          Name given to the assistant: <span className="font-semibold text-ink-soft">{order.buyerName}</span>
        </p>
      )}

      <div className="rule-dashed flex flex-col gap-1.5 pt-4">
        {order.fulfillment === 'pickup' ? (
          <>
            <h3 className="flex items-center gap-1.5 type-label">
              <Icon icon={Store} size="sm" /> Pickup
            </h3>
            <p className="text-ink-soft">{shop.pickupNotes || 'The buyer collects from you.'}</p>
          </>
        ) : (
          <>
            <h3 className="flex items-center gap-1.5 type-label">
              <Icon icon={MapPin} size="sm" /> Ship to
            </h3>
            {a && (a.line1 || a.city) ? (
              <>
                <address className="not-italic leading-6">
                  {a.name && <span className="block font-semibold">{a.name}</span>}
                  {a.line1 && <span className="block">{a.line1}</span>}
                  {a.line2 && <span className="block">{a.line2}</span>}
                  <span className="block">
                    {[a.city, [a.state, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  </span>
                  {a.countryCode && <span className="block">{a.countryCode}</span>}
                </address>
                <p className="type-meta text-ink-muted">From PayPal</p>
              </>
            ) : paid ? (
              <p className="flex items-start gap-2 font-medium text-warn">
                <Icon icon={TriangleAlert} className="mt-0.5" />
                PayPal didn’t share an address. Contact the buyer before shipping.
              </p>
            ) : (
              <p className="text-ink-soft">The buyer picks the address on PayPal when they approve.</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ItemsCard({ order, className }: { order: Order; className?: string }) {
  return (
    <div className={cx('paper-drop', className)}>
    <Card
      as="section"
      aria-labelledby="items-title"
      tone="flat"
      padding="none"
      className="perforated flex flex-col gap-4 border-0 px-5 pt-5 sm:px-7 sm:pt-7"
    >
      <SectionTitle id="items-title">Items</SectionTitle>
      <dl className="type-receipt rule-dashed flex flex-col gap-3 pt-4">
        {order.lines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <dt className="flex flex-col">
              <span>
                <span className="font-semibold">{l.qty} ×</span> {lineName(l)}
              </span>
              <span className="type-meta text-ink-muted">{formatUSD(l.unitCents)} each</span>
            </dt>
            <dd>{formatUSD(l.unitCents * l.qty)}</dd>
          </div>
        ))}
        <div className="rule-dashed flex justify-between gap-4 pt-3 text-ink-soft">
          <dt>Items</dt>
          <dd>{formatUSD(order.itemsCents)}</dd>
        </div>
        {order.fulfillment === 'shipping' && (
          <div className="flex justify-between gap-4 text-ink-soft">
            <dt>Shipping</dt>
            <dd>{formatUSD(order.shippingCents)}</dd>
          </div>
        )}
        <div className="rule-dashed flex items-baseline justify-between gap-4 pt-3 text-xl leading-7 font-semibold">
          <dt>Total</dt>
          <dd>{formatUSD(order.totalCents)}</dd>
        </div>
      </dl>
      <p className="type-meta text-ink-muted">Prices come from your menu. The assistant could only pick items and quantities.</p>
    </Card>
    </div>
  );
}

const DOT: Record<TimelineEntry['tone'], string> = {
  neutral: 'bg-control',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
};

function TimelineCard({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <Card as="section" aria-labelledby="timeline-title" padding="lg" className={cx('flex flex-col gap-4', className)}>
      <SectionTitle id="timeline-title">What happened</SectionTitle>
      <ol className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden="true" className="absolute top-4 bottom-0 left-[4px] border-l-[1.5px] border-dashed border-line-strong" />}
            <span aria-hidden="true" className={cx('mt-1.5 size-2.5 shrink-0 rotate-45', DOT[e.tone])} />
            <div className="flex flex-col">
              <span className="font-medium">{e.text}</span>
              <LocalTime iso={e.at} className="type-meta text-ink-muted" />
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PayPalCard({ shop, order, className }: { shop: Shop; order: Order; className?: string }) {
  const words = paypalCardWords(order, isDemoShop(shop));
  const row = (label: string, value: string | null, what: string, empty: string) => (
    <div className="flex flex-col gap-0.5">
      <dt className="type-meta text-ink-muted">{label}</dt>
      <dd className="flex min-h-tap items-center justify-between gap-2">
        {value ? (
          <>
            <span className="type-price font-mono text-sm [overflow-wrap:anywhere]" data-testid={what.replace(/\s+/g, '-')}>
              {value}
            </span>
            <CopyButton text={value} what={what} iconOnly />
          </>
        ) : (
          <span className="text-sm text-ink-muted">{empty}</span>
        )}
      </dd>
    </div>
  );
  return (
    <Card as="section" aria-labelledby="paypal-title" padding="lg" className={cx('flex flex-col gap-3', className)}>
      <SectionTitle id="paypal-title">PayPal</SectionTitle>
      <dl className="flex flex-col gap-2">
        {/* The account this order pays: the email it was created with (a later Settings change doesn't move it). */}
        <div className="flex flex-col gap-0.5">
          <dt className="type-meta text-ink-muted">Paid to</dt>
          <dd className="flex min-h-tap items-center font-medium [overflow-wrap:anywhere]" data-testid="paid-to">
            {words.paidTo}
          </dd>
        </div>
        {row('Order ID', order.paypalOrderId, 'PayPal order ID', '')}
        {row('Transaction ID', order.captureId, 'PayPal transaction ID', 'Created when the payment is received')}
      </dl>
      <p className="type-meta text-ink-muted">{words.note}</p>
    </Card>
  );
}

export default async function OrderDetailPage({ params }: PageProps<'/shops/[id]/orders/[orderId]'>) {
  const { id, orderId } = await params;
  const shop = await requireOwner(id);
  const db = getDb();
  const stored = ordersRepo.byId(db, orderId);
  if (!stored || stored.shopId !== shop.id) notFound();
  // A paid order whose brief never arrived (restart mid-write) shows the labelled template and stops polling.
  const order = withFallbackBrief(stored);
  const trackers = ordersRepo.trackers(db, order.id);
  const events = eventsRepo.list(db, order.id);
  const entries = timelineEntries(events, order);
  const pending = isOpen(order.status) || ((order.status === 'paid' || order.status === 'fulfilled') && !order.brief);

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pt-4 pb-section lg:pt-8">
      <AutoRefresh active={pending} />
      <Link
        href={`/shops/${shop.id}`}
        className="-ml-1 inline-flex min-h-tap items-center gap-1.5 self-start rounded-sm px-1 font-semibold text-ink-soft hover:text-ink"
      >
        <Icon icon={ArrowLeft} size="sm" />
        Orders
      </Link>

      {/* Phone: number, status, who placed it, then the total as a till line. Wider: the total is the right-hand block. */}
      <header className="flex flex-col gap-4 border-b-2 border-ink pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* The reference never breaks; if the line is too narrow, it wraps after "Order". */}
            <h1 className="type-display">
              Order <span className="type-price font-semibold tracking-tight whitespace-nowrap">{order.number}</span>
            </h1>
            <OrderStatusBadge order={order} />
          </div>
          <p className="text-ink-soft">
            Placed by {agentLabel(order.agentName)}, <LocalTime iso={order.createdAt} />
          </p>
        </div>
        <p className="rule-dashed flex items-baseline justify-between gap-4 pt-3 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1 sm:border-t-0 sm:pt-0">
          <span className="type-label text-ink-muted">Total</span>
          <span className="type-price text-3xl leading-none font-semibold sm:text-4xl">{formatUSD(order.totalCents)}</span>
        </p>
      </header>

      {/* Phone: brief, action, buyer, items, timeline, PayPal. Desktop: two columns. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          <BriefCard order={order} className="order-1 lg:order-none" />
          <ItemsCard order={order} className="order-4 lg:order-none" />
          <TimelineCard entries={entries} className="order-5 lg:order-none" />
        </div>
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <ActionCard
            shop={shop}
            order={order}
            trackers={trackers}
            declined={cardDeclined(order, events)}
            byShop={cancelledByShop(order, events)}
            held={heldForUnknownEmail(order, events)}
            className="order-2 lg:order-none"
          />
          <BuyerCard shop={shop} order={order} className="order-3 lg:order-none" />
          <PayPalCard shop={shop} order={order} className="order-6 lg:order-none" />
        </div>
      </div>
    </div>
  );
}
