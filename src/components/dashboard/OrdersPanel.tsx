'use client';

import { Bot, ChevronDown, CloudOff, Inbox } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { Order } from '@/lib/domain/types';
import { groupOrders } from '@/lib/seller/view';
import { OrderCard } from './OrderCard';

function Count({ n }: { n: number }) {
  return <span className="type-receipt rounded-xs border border-line-strong px-1.5 text-sm font-medium text-ink-soft">{n}</span>;
}

export function PayPalBanner() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-md bg-warn-soft px-4 py-3 text-warn">
      <Icon icon={CloudOff} className="mt-0.5" />
      <p>
        <span className="font-semibold">We can’t reach PayPal right now.</span>{' '}
        Payments buyers make on PayPal will show up here as soon as it answers. Nothing is lost.
      </p>
    </div>
  );
}

function EmptyState({ slug, onShowShare }: { slug: string; onShowShare: () => void }) {
  return (
    <Card tone="flat" padding="lg" className="flex flex-col items-start gap-4">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Icon icon={Inbox} size="lg" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="type-heading">No orders yet</h2>
        <p className="max-w-measure text-ink-soft">
          When an AI assistant orders through your agent door, the order shows up here, ready to prepare as soon as the buyer pays on PayPal.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <ButtonLink href={`/s/${slug}?assistant=1`} variant="primary" icon={Bot} className="w-full sm:w-auto">
          Watch an AI order from you
        </ButtonLink>
        <button
          type="button"
          onClick={onShowShare}
          className="inline-flex min-h-tap items-center justify-center px-2 font-semibold text-accent-ink underline underline-offset-4 hover:decoration-ink"
        >
          Share your agent door
        </button>
      </div>
    </Card>
  );
}

export function OrdersPanel({
  orders,
  shopId,
  slug,
  fresh,
  paypalReachable,
  onOrderChange,
  onShowShare,
}: {
  orders: Order[];
  shopId: string;
  slug: string;
  fresh: ReadonlySet<string>;
  paypalReachable: boolean;
  onOrderChange: (order: Order) => void;
  onShowShare: () => void;
}) {
  const g = groupOrders(orders);
  const card = (o: Order) => <OrderCard key={o.id} order={o} shopId={shopId} fresh={fresh.has(o.id)} onChange={onOrderChange} />;

  return (
    <div className="flex flex-col gap-8">
      {!paypalReachable && <PayPalBanner />}

      {orders.length === 0 ? (
        <EmptyState slug={slug} onShowShare={onShowShare} />
      ) : (
        <>
          <section aria-labelledby="group-prepare" className="flex flex-col gap-3">
            <h2 id="group-prepare" className="type-heading flex items-center gap-2">
              To prepare <Count n={g.toPrepare.length} />
            </h2>
            {g.toPrepare.length > 0 ? (
              <ul className="paper-drop grid gap-4 lg:grid-cols-2">{g.toPrepare.map(card)}</ul>
            ) : (
              <p className="text-ink-muted">Nothing to prepare right now. Paid orders show up here.</p>
            )}
          </section>

          {g.waiting.length > 0 && (
            <details className="group" data-group="waiting">
              <summary className="flex min-h-tap list-none items-center rounded-md [&::-webkit-details-marker]:hidden">
                <h2 className="type-heading flex items-center gap-2">
                  Waiting for payment <Count n={g.waiting.length} />
                  <Icon icon={ChevronDown} className="text-ink-muted transition-transform duration-(--duration-base) group-open:rotate-180" />
                </h2>
              </summary>
              <div className="mt-1 flex flex-col gap-3">
                <p className="type-meta text-ink-muted">
                  The buyer still has to approve on PayPal. Nothing is charged until they do, and unpaid orders expire after 60 minutes.
                </p>
                <ul className="paper-drop grid gap-4 lg:grid-cols-2">{g.waiting.map(card)}</ul>
              </div>
            </details>
          )}

          {g.done.length > 0 && (
            <section aria-labelledby="group-done" className="flex flex-col gap-3">
              <h2 id="group-done" className="type-heading flex items-center gap-2">
                Done <Count n={g.done.length} />
              </h2>
              <ul className="paper-drop grid gap-4 lg:grid-cols-2">{g.done.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
