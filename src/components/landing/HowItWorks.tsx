import Image from 'next/image';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { OrderStatusText } from '@/components/dashboard/status';
import { Reveal } from '@/components/motion';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PanelList, PanelRow } from '@/components/ui/panel';
import { TextLink } from '@/components/ui/text-link';
import { formatUSD } from '@/lib/domain/money';

// One order, followed through the four artefacts: the same lines and total as the hero's picture.
const LINES = [
  { qty: 2, name: 'Almond croissant', cents: 500 },
  { qty: 1, name: 'Country sourdough loaf', cents: 900 },
] as const;
const SHIPPING = 800;
const TOTAL = LINES.reduce((sum, l) => sum + l.qty * l.cents, 0) + SHIPPING;

function Paper() {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-(--card-radius) bg-tile-rose lg:aspect-auto lg:h-full">
      <Image
        src="/samples/marigold-bakehouse.jpg"
        alt="A handwritten price list on a sheet of lined paper"
        fill
        sizes="(min-width: 64rem) 25vw, 100vw"
        className="object-cover object-[50%_45%]"
      />
    </div>
  );
}

/** Rows as the seller checks them, with the one Claude stopped to ask about. */
function ReadRows() {
  const row = 'flex items-baseline justify-between gap-3 font-semibold';
  return (
    <PanelList aria-hidden="true" className="grid auto-rows-fr lg:h-full">
      <PanelRow className="content-center">
        <p className={row}>
          <span className="min-w-0">Country sourdough loaf</span> <span className="type-figures">{formatUSD(900)}</span>
        </p>
      </PanelRow>
      <PanelRow className="content-center">
        <p className={row}>
          <span className="min-w-0">Butter croissant</span> <span className="type-figures">{formatUSD(425)}</span>
        </p>
      </PanelRow>
      <PanelRow className="content-center">
        <p className="font-semibold">Pain au chocolat</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-warn">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
          Is this $4 or $14?
        </p>
      </PanelRow>
      <PanelRow className="content-center">
        <p className={row}>
          <span className="min-w-0">Almond croissant</span> <span className="type-figures">{formatUSD(500)}</span>
        </p>
      </PanelRow>
    </PanelList>
  );
}

/** The buyer's approval card, ending in the button that goes to PayPal. Inert here: it stands for the real one. */
function ApproveCard() {
  return (
    <Card aria-hidden="true" className="flex flex-col lg:h-full">
      <p className="flex items-center gap-2 font-bold">
        <LogoMark className="size-7" />
        Ready to pay
      </p>
      <ul className="mt-4 flex flex-col gap-1 type-receipt">
        {LINES.map((l) => (
          <li key={l.name} className="flex justify-between gap-3">
            <span className="min-w-0">
              {l.qty} × {l.name}
            </span>
            <span>{formatUSD(l.qty * l.cents)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 text-ink-muted">
          <span>Shipping</span>
          <span>{formatUSD(SHIPPING)}</span>
        </li>
      </ul>
      <span
        className={buttonClasses({
          variant: 'paypal',
          fullWidth: true,
          className: 'pointer-events-none mt-6 text-sm tabular-nums lg:mt-auto',
        })}
      >
        Approve {formatUSD(TOTAL)} on PayPal
      </span>
    </Card>
  );
}

/** The seller's order row: paid, with the brief under it. */
function PaidOrder() {
  return (
    <Card aria-hidden="true" className="flex flex-col gap-3 lg:h-full">
      <div className="flex items-baseline justify-between gap-3 font-bold type-figures">
        <span className="min-w-0">SHF-K7F2QX</span>
        <span>{formatUSD(TOTAL)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 text-ink-soft">Dana R.</span>
        <OrderStatusText order={{ status: 'paid', fulfillment: 'shipping', captureRefused: false }} />
      </div>
      <ul className="border-t border-line pt-3 type-receipt text-ink-soft">
        {LINES.map((l) => (
          <li key={l.name}>
            {l.qty} × {l.name}
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-md bg-note-soft p-3 text-sm text-note-ink lg:mt-auto">
        <span className="mr-1.5 font-bold text-note">AI brief</span>
        Ships to Austin. The almond croissants contain nuts, so pack them apart from the loaf.
      </p>
    </Card>
  );
}

function Step({ artefact, children }: { artefact: ReactNode; children: ReactNode }) {
  return (
    <li>
      <figure className="flex h-full flex-col gap-4">
        <div className="lg:h-80">{artefact}</div>
        <figcaption className="type-body text-ink-soft">{children}</figcaption>
      </figure>
    </li>
  );
}

export function HowItWorks({ exampleShopHref }: { exampleShopHref: string | null }) {
  return (
    <section aria-labelledby="how-it-works" className="mx-auto w-full max-w-page px-gutter pt-section">
      <h2 id="how-it-works" className="type-display max-w-[24ch]">
        From the paper on your counter to a paid order
      </h2>
      <Reveal as="ol" className="mt-8 grid gap-6 lg:grid-cols-4">
        <Step artefact={<Paper />}>Snap your price list.</Step>
        <Step artefact={<ReadRows />}>Claude reads it and asks about anything unclear.</Step>
        <Step artefact={<ApproveCard />}>
          Your shop gets an agent door, an address any AI assistant can order through. Buyers approve on PayPal.
        </Step>
        <Step artefact={<PaidOrder />}>You get the order and a short brief.</Step>
      </Reveal>
      {exampleShopHref && (
        <p className="mt-6">
          <TextLink href={exampleShopHref}>See an example shop</TextLink>
        </p>
      )}
    </section>
  );
}
