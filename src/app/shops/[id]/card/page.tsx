// Counter card (spec §4, §10a): a 5 × 7 in card for the counter. Its QR code opens the shop page, which carries the
// agent door; the door's address is printed small for anyone setting up an assistant by hand. Owner only, outside the
// dashboard's tabs; printing shows the card alone (globals.css, `data-print-alone`).
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Icon } from '@/components/ui/Icon';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { qrSvg } from '@/lib/discovery/qr';
import { PrintButton } from './PrintButton';

export async function generateMetadata({ params }: PageProps<'/shops/[id]/card'>): Promise<Metadata> {
  const { id } = await params;
  const shop = await getOwnedShop(id).catch(() => null);
  return { title: shop ? `Counter card · ${shop.name} · Shelfie` : 'Counter card · Shelfie', robots: { index: false } };
}

/** The link as people type it: "https://shelfie.example/s/rosa" → "shelfie.example/s/rosa". */
const asTyped = (url: string) => url.replace(/^https?:\/\//, '');

export default async function CounterCardPage({ params }: PageProps<'/shops/[id]/card'>) {
  const { id } = await params;
  const shop = await requireOwner(id);
  const shopUrl = `${getConfig().appUrl}/s/${shop.slug}`;
  const doorUrl = `${shopUrl}/mcp`;
  const qr = await qrSvg(shopUrl);

  return (
    <div className="mx-auto flex w-full max-w-page flex-col items-center gap-8 px-gutter pt-6 pb-section lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:pt-12 print:p-0">
      <div className="flex w-full max-w-measure flex-col gap-5 lg:pt-4 print:hidden">
        <Link
          href={`/shops/${shop.id}?tab=share`}
          className="inline-flex min-h-tap items-center gap-1.5 self-start font-semibold text-accent-ink underline underline-offset-4 hover:decoration-ink"
        >
          <Icon icon={ArrowLeft} size="sm" />
          Back to Share
        </Link>
        <div className="flex flex-col gap-3">
          <h1 className="type-display">Counter card</h1>
          <p className="type-lead text-ink-soft">
            Stand it by your till. People scan the code to open your menu, and their AI assistants can order from it
            through your agent door.
          </p>
        </div>
        {shop.status === 'draft' && (
          <p className="flex items-start gap-2.5 rounded-md bg-warn-soft px-4 py-3 font-semibold text-warn">
            <Icon icon={TriangleAlert} className="mt-0.5" />
            <span>
              Your shop isn’t published yet.{' '}
              <span className="font-normal">
                Until it is, the code opens a page that doesn’t exist.{' '}
                <Link href={`/shops/${shop.id}/setup`} className="font-semibold underline underline-offset-4">
                  Finish setting up
                </Link>
              </span>
            </span>
          </p>
        )}
        <div className="flex flex-col gap-2">
          <PrintButton />
          <p className="type-meta text-ink-muted">Prints 5 × 7 inches on letter or A4 paper. Cut along the black border.</p>
        </div>
      </div>

      <article
        data-print-alone
        aria-labelledby="card-shop-name"
        className="@container relative flex aspect-[5/7] w-full max-w-card flex-col items-center border-2 border-ink bg-surface-raised px-7 pt-10 pb-6 text-center shadow-lg [print-color-adjust:exact] sm:px-11 sm:pt-12 sm:pb-8 print:shadow-none"
      >
        {/* A printed menu card's frame: a hairline just inside the heavy edge. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 border border-ink" />
        {/* A strip of tape holding the card to the page (screen only), like the price list on the shop page. */}
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 bg-accent/70 shadow-xs print:hidden"
        />
        {/* Sizes follow the card's own width (container queries), so the preview at 5 in matches the print. */}
        <header className="flex flex-col items-center gap-3 @md:gap-4">
          <h2
            id="card-shop-name"
            className="font-display text-4xl leading-[1.04] font-extrabold tracking-display [overflow-wrap:anywhere] @md:text-5xl"
          >
            {shop.name}
          </h2>
          <span aria-hidden="true" className="h-0.5 w-12 bg-ink" />
          <p className="text-lg leading-snug text-ink @md:text-xl">
            {/* Each phrase stays on one line where it fits, so the line breaks after the comma. */}
            <span className="inline-block">Order ahead with any AI assistant,</span>{' '}
            <span className="inline-block">pay with PayPal</span>
          </p>
        </header>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-1.5 py-6">
          <div
            role="img"
            aria-label={`QR code that opens ${asTyped(shopUrl)}`}
            data-testid="card-qr"
            className="aspect-square w-3/5 [&>svg]:block [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="mt-1 type-kicker">Scan for the menu</p>
          <p className="type-price text-sm [overflow-wrap:anywhere]" data-testid="card-shop-url">
            {asTyped(shopUrl)}
          </p>
        </div>

        <footer className="rule-dashed flex w-full items-end justify-between gap-4 pt-3 text-left">
          <p className="min-w-0 type-meta text-ink-soft">
            <span className="font-semibold text-ink">Agent door</span> for AI assistants
            <span className="block type-price text-ink [overflow-wrap:anywhere]" data-testid="card-door-url">
              {doorUrl}
            </span>
          </p>
          <Logo size="sm" className="shrink-0" />
        </footer>
      </article>
    </div>
  );
}
