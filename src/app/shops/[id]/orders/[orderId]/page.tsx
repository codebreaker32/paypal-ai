// Order detail (spec §4): one order end to end. Owner only, SQLite only; refreshes itself while payment or the brief is pending.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CircleCheck, Mail, Settings, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { BriefCard } from '@/components/dashboard/BriefCard';
import { CopyButton } from '@/components/dashboard/CopyButton';
import { withFallbackBrief } from '@/lib/ai/template';
import { AutoRefresh, PickupAction } from '@/components/dashboard/DetailClient';
import { LocalTime } from '@/components/dashboard/LocalTime';
import { TrackingForm } from '@/components/dashboard/TrackingForm';
import { OrderStatusText } from '@/components/dashboard/status';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import { formatUSD } from '@/lib/domain/money';
import { TRACK_IN_YOUR_PAYPAL, isDemoShop } from '@/lib/domain/payee';
import type { Order, Shop, Tracker } from '@/lib/domain/types';
import { isOpen } from '@/lib/orders/state';
import { actionWords, agentLabel, buyerLabel, cancelledByShop, cardDeclined, heldForUnknownEmail, lineName, paypalCardWords, timelineEntries, type TimelineEntry } from '@/lib/seller/view';

export async function generateMetadata({ params }: PageProps<'/shops/[id]/orders/[orderId]'>): Promise<Metadata> {
  const { id, orderId } = await params;
  const shop = await getOwnedShop(id).catch(() => null);
  const order = shop ? ordersRepo.byId(getDb(), orderId) : null;
  return { title: order && order.shopId === shop?.id ? `Order ${order.number} · Shelfie` : 'Order · Shelfie', robots: { index: false } };
}

/** The page's sections sit on the white page, divided by a rule: no outlined cards. */
const SECTION = 'flex flex-col gap-3 border-t border-line pt-5';

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
              ? 'Ship it, then add tracking here for the buyer’s assistant. Add it in your PayPal account too.'
              : 'Ship it, then add tracking. It goes to PayPal for the buyer.'}
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
            <p className="type-meta text-ink-muted">{TRACK_IN_YOUR_PAYPAL}</p>
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
    <section id="tracking" aria-labelledby="action-title" className={cx(SECTION, 'scroll-mt-4', className)}>
      {body}
    </section>
  );
}

function BuyerCard({ shop, order, className }: { shop: Shop; order: Order; className?: string }) {
  const a = order.shipTo;
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  return (
    <section aria-labelledby="buyer-title" className={cx(SECTION, 'gap-4', className)}>
      <SectionTitle id="buyer-title">Buyer</SectionTitle>
      {order.payerName || order.payerEmail ? (
        <div className="flex flex-col gap-1">
          {order.payerName && <p className="font-semibold">{order.payerName}</p>}
          {order.payerEmail && (
            <a href={`mailto:${order.payerEmail}`} className="inline-flex min-h-tap items-center gap-1.5 self-start text-ink underline underline-offset-4 [overflow-wrap:anywhere]">
              <Icon icon={Mail} size="sm" />
              {order.payerEmail}
            </a>
          )}
        </div>
      ) : (
        <p className="text-ink-soft">PayPal shares the buyer’s name{order.fulfillment === 'shipping' ? ' and address' : ''} once they approve.</p>
      )}
      {order.buyerName && order.buyerName !== order.payerName && (
        <p className="text-sm text-ink-soft">
          Told the assistant <span className="font-semibold text-ink">{order.buyerName}</span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {order.fulfillment === 'pickup' ? (
          <>
            <h3 className="type-label text-ink-muted">
              Pickup
            </h3>
            <p className="text-ink-soft">{shop.pickupNotes || 'The buyer collects from you.'}</p>
          </>
        ) : (
          <>
            <h3 className="type-label text-ink-muted">
              Ship to
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
    </section>
  );
}

function ItemsCard({ order, photos, className }: { order: Order; photos: ReadonlyMap<string, string | null>; className?: string }) {
  return (
    <section aria-labelledby="items-title" className={cx(SECTION, 'gap-4', className)}>
      <SectionTitle id="items-title">Items</SectionTitle>
      <dl className="type-receipt flex flex-col gap-3 text-base">
        {order.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <dt className="flex min-w-0 flex-1 items-center gap-3">
              <ItemPhoto name={lineName(l)} photoUrl={photos.get(l.itemId) ?? null} size="sm" decorative eager className="size-11 shrink-0 rounded-(--thumb-radius)" />
              <span className="flex min-w-0 flex-col">
                <span>
                  <span className="font-semibold">{l.qty} ×</span> {lineName(l)}
                </span>
                <span className="type-meta text-ink-muted">{formatUSD(l.unitCents)} each</span>
              </span>
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
        <div className="rule-dashed flex items-baseline justify-between gap-4 pt-3 text-xl leading-7 font-bold">
          <dt>Total</dt>
          <dd>{formatUSD(order.totalCents)}</dd>
        </div>
      </dl>
    </section>
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
    <section aria-labelledby="timeline-title" className={cx(SECTION, 'gap-4', className)}>
      <SectionTitle id="timeline-title">What happened</SectionTitle>
      <ol className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden="true" className="absolute top-4 bottom-0 left-[4px] border-l-2 border-line" />}
            <span aria-hidden="true" className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[e.tone])} />
            <div className="flex flex-col">
              <span className="font-medium">{e.text}</span>
              <LocalTime iso={e.at} className="type-meta text-ink-muted" />
            </div>
          </li>
        ))}
      </ol>
    </section>
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
    <section aria-labelledby="paypal-title" className={cx(SECTION, className)}>
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
      {/* Only when the money isn't in the seller's own account: that is the one place they would look and not find it. */}
      {order.payeeEmail === null && <p className="type-meta text-ink-muted">{words.note}</p>}
    </section>
  );
}

/** Desktop only: the shop's orders beside the open one (list + detail), the open one marked. */
function OrderList({ shopId, orders, current, photos }: { shopId: string; orders: Order[]; current: string; photos: ReadonlyMap<string, string | null> }) {
  return (
    <nav aria-label="All orders" className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto border-r border-line pr-3 lg:block">
      <ul className="flex flex-col gap-0.5">
        {orders.map((o) => {
          const first = o.lines[0];
          const here = o.id === current;
          return (
            <li key={o.id}>
              <Link
                href={`/shops/${shopId}/orders/${o.id}`}
                aria-current={here ? 'page' : undefined}
                className={cx('flex items-center gap-3 rounded-(--thumb-radius) px-3 py-2.5 no-underline hover:bg-surface-sunken', here && 'bg-surface-sunken')}
              >
                <ItemPhoto name={first?.name ?? o.number} photoUrl={first ? (photos.get(first.itemId) ?? null) : null} size="sm" decorative className="size-10 shrink-0 rounded-(--thumb-radius)" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="type-price text-sm font-bold">{o.number}</span>
                    <span className="type-price text-sm font-semibold">{formatUSD(o.totalCents)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-muted">{buyerLabel(o)}</span>
                    <OrderStatusText order={o} className="shrink-0 text-xs" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
  const allOrders = ordersRepo.listByShop(db, shop.id);
  const photos = new Map(itemsRepo.listWithVariants(db, shop.id).map((i) => [i.id, i.photoUrl]));

  return (
    <div className="mx-auto grid w-full max-w-wide items-start gap-8 px-gutter pt-4 pb-section lg:grid-cols-[21rem_minmax(0,1fr)] lg:pt-8">
      <AutoRefresh active={pending} />
      <OrderList shopId={shop.id} orders={allOrders} current={order.id} photos={photos} />
      <div className="flex min-w-0 flex-col gap-6">
      <Link
        href={`/shops/${shop.id}`}
        className="-ml-1 inline-flex min-h-tap items-center gap-1.5 self-start rounded-sm px-1 font-semibold text-ink-soft hover:text-ink"
      >
        <Icon icon={ArrowLeft} size="sm" />
        Orders
      </Link>

      {/* Phone: number, status, who placed it, then the total as a till line. Wider: the total is the right-hand block. */}
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* The reference never breaks; if the line is too narrow, it wraps after "Order". */}
            <h1 className="type-display">
              Order <span className="type-price font-semibold tracking-tight whitespace-nowrap">{order.number}</span>
            </h1>
            <OrderStatusText order={order} className="text-base" />
          </div>
          <p className="text-ink-soft">
            Placed by {agentLabel(order.agentName)}, <LocalTime iso={order.createdAt} />
          </p>
        </div>
        <p className="rule-dashed flex items-baseline justify-between gap-4 pt-3 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1 sm:border-t-0 sm:pt-0">
          <span className="type-label text-ink-muted">Total</span>
          <span className="type-price text-3xl leading-none font-extrabold tracking-tight sm:text-4xl">{formatUSD(order.totalCents)}</span>
        </p>
      </header>

      {/* Phone: brief, action, buyer, items, timeline, PayPal. Desktop: two columns. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          <BriefCard order={order} className="order-1 lg:order-none" />
          <ItemsCard order={order} photos={photos} className="order-4 lg:order-none" />
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
    </div>
  );
}
