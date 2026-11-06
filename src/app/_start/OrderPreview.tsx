import Image from 'next/image';
import { Bot, CircleCheck, DoorOpen, Search, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';

// Prices are the ones written on public/samples/marigold-bakehouse.jpg.
const LINES = [
  { qty: 2, name: 'Almond croissant', unitCents: 500 },
  { qty: 1, name: 'Country sourdough loaf', unitCents: 900 },
] as const;
const TOTAL_CENTS = LINES.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
const ORDER_REF = 'SHF-K7F2QX';

function BuyerSays({ children }: { children: string }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-lg rounded-br-xs bg-ink px-3.5 py-2.5 text-sm leading-5 text-surface">
      {children}
    </p>
  );
}

function AgentStep({ icon, children }: { icon: typeof DoorOpen; children: string }) {
  return (
    <li className="flex items-center gap-2 type-meta text-ink-muted">
      <Icon icon={icon} size="sm" />
      {children}
    </li>
  );
}

/** The seller’s side: the order as it lands on the dashboard. */
function PaymentReceived({ className }: { className?: string }) {
  return (
    <Card
      padding="none"
      className={cx(
        'relative items-center gap-3 p-3 pr-4 shadow-md animate-rise-in [animation-delay:600ms]',
        className,
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-ok-soft text-ok">
        <Icon icon={CircleCheck} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold whitespace-nowrap">Payment received</span>
        <span className="type-meta text-ink-muted">Pickup Saturday</span>
      </span>
      <span className="type-amount shrink-0 text-lg text-ok">{formatUSD(TOTAL_CENTS)}</span>
    </Card>
  );
}

/**
 * Static, realistic example of what Shelfie produces: Marigold’s photographed price list, a buyer’s
 * assistant ordering from it, and the payment landing with the seller. Built from the same UI
 * components the buyer console and dashboard use, not a screenshot.
 */
export function OrderPreview() {
  return (
    <figure aria-labelledby="order-preview-caption" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* The photo, with the seller’s view of the paid order pinned to it */}
        <div className="relative flex flex-col lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <Image
            src="/samples/marigold-bakehouse.jpg"
            alt="Photo of Marigold Bakehouse’s handwritten price list: breads, pastries, cakes and coffee, priced in pen."
            width={1200}
            height={1500}
            loading="eager"
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="aspect-[4/3] w-full rounded-lg object-cover object-[50%_38%] shadow-lg lg:aspect-[4/5] lg:object-center"
          />
          <PaymentReceived className="z-20 hidden lg:-mt-12 lg:ml-4 lg:mr-14 lg:flex" />
        </div>

        {/* The buyer’s assistant ordering through the shop’s agent door */}
        <Card
          padding="none"
          className="relative z-10 mx-3 -mt-16 overflow-hidden shadow-md lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:mx-0 lg:mt-14 lg:self-start animate-rise-in [animation-delay:150ms]"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Icon icon={Bot} className="text-ink-soft" />
            <span className="flex-1 type-label">Dana’s AI assistant</span>
            <Badge>Example</Badge>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4">
            <BuyerSays>Two almond croissants and a sourdough loaf from Marigold, for Saturday pickup.</BuyerSays>

            <ul className="flex flex-col gap-1">
              <AgentStep icon={DoorOpen}>Opened Marigold Bakehouse’s agent door</AgentStep>
              <AgentStep icon={Search}>Found both items and their prices on the menu</AgentStep>
            </ul>

            <div className="flex flex-col gap-2 text-sm leading-5">
              <p>Here’s the order. Prices come from the shop:</p>
              <dl className="type-price flex flex-col rounded-md border border-line bg-surface px-3 py-1">
                {LINES.map((l) => (
                  <div key={l.name} className="flex justify-between gap-3 border-b border-line py-1.5">
                    <dt>
                      <span className="inline-block min-w-6 font-semibold text-ink-soft">{l.qty} ×</span> {l.name}
                    </dt>
                    <dd>{formatUSD(l.qty * l.unitCents)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 py-2 font-semibold">
                  <dt>Total, pickup at 14 Alder St</dt>
                  <dd className="rule-total">{formatUSD(TOTAL_CENTS)}</dd>
                </div>
              </dl>
              <p className="flex items-start gap-1.5 text-warn">
                <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
                <span>The menu says the almond croissants contain nuts.</span>
              </p>
              <p>Shall I place it?</p>
            </div>

            <BuyerSays>Yes, go ahead.</BuyerSays>

            <div className="flex flex-col gap-2.5 rounded-md border border-line-strong border-t-4 border-t-ink p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">Marigold Bakehouse</span>
                  <span className="type-meta text-ink-muted">
                    Order <span className="type-ref">{ORDER_REF}</span>
                  </span>
                </span>
                <span className="type-amount rule-total text-xl">{formatUSD(TOTAL_CENTS)}</span>
              </div>
              {/* A picture of the approval button the buyer sees; not a control on this page. */}
              <span className={cx(buttonClasses({ variant: 'paypal', fullWidth: true }), 'pointer-events-none')}>
                Approve {formatUSD(TOTAL_CENTS)} on PayPal
              </span>
            </div>
          </div>
        </Card>

        <PaymentReceived className="z-20 mx-3 mt-3 flex lg:hidden" />
      </div>

      <figcaption id="order-preview-caption" className="type-meta text-ink-muted lg:pl-1">
        Example: a buyer’s AI assistant orders from Marigold Bakehouse’s photographed price list, and pays on PayPal.
      </figcaption>
    </figure>
  );
}
