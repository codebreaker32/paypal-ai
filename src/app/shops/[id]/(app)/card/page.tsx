// Counter card (spec §4, §10a): a 5 × 7 in card for the counter. Its QR code opens the shop page, which carries the
// agent door; the door's address is printed small for anyone setting up an assistant by hand. Owner only, outside the
// dashboard's tabs; printing shows the card alone (globals.css, `data-print-alone`). A draft shop has no card yet: its
// `draft-xxxxxxxx` address is replaced at first publish, so a card printed before then would never open the shop.
import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { PageHeader } from '@/components/app/PageHeader';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
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
  // No card for a draft: its address changes at first publish.
  const qr = shop.status === 'draft' ? null : await qrSvg(shopUrl);

  return (
    <div className="flex w-full flex-col print:p-0">
      <PageHeader
        title="Counter card"
        description="Stand it by your till. A scan opens your menu, and any AI assistant can order from it."
        back={{ href: `/shops/${shop.id}?tab=share`, label: 'Share' }}
        actions={qr !== null ? <PrintButton /> : undefined}
      />

      {qr === null && (
        <p className="flex max-w-measure items-start gap-2.5 rounded-(--card-radius) bg-warn-soft px-4 py-3 font-semibold text-warn">
          <Icon icon={TriangleAlert} className="mt-0.5" />
          <span>
            Your counter card is ready once your shop is live.{' '}
            <span className="font-normal">
              Your shop gets its web address when you publish, and the card’s code opens that address.{' '}
              <Link href={`/shops/${shop.id}/setup`} className="press-text font-semibold underline underline-offset-4 decoration-line-strong decoration-2 hover:decoration-ink">
                Finish setting up
              </Link>
            </span>
          </span>
        </p>
      )}

      {qr !== null && (
        <div className="flex flex-col items-center gap-3">
        <article
          data-print-alone
          aria-labelledby="card-shop-name"
          className="@container relative flex aspect-[5/7] w-full max-w-card flex-col items-center overflow-hidden rounded-(--radius-2xl) border border-line-strong bg-surface-raised text-center shadow-lg [print-color-adjust:exact] print:shadow-none"
        >
          {/* The shop's own cover leads the card, as it leads the shop page. */}
          {shop.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a site-relative upload or bundled demo photo, printed as is
            <img src={shop.coverUrl} alt="" className="h-[17%] w-full shrink-0 object-cover" />
          )}
          {/* Sizes follow the card's own width (container queries), so the preview at 5 in matches the print. */}
          <div className={cx('flex w-full flex-1 flex-col items-center px-7 pb-6 sm:px-10 sm:pb-7', shop.coverUrl ? 'pt-6 sm:pt-7' : 'pt-10 sm:pt-12')}>
            <header className="flex flex-col items-center gap-2.5 @md:gap-3">
              <h2
                id="card-shop-name"
                className="font-display text-4xl leading-[1.04] font-extrabold tracking-display [overflow-wrap:anywhere] @md:text-5xl"
              >
                {shop.name}
              </h2>
              <p className="text-lg leading-snug text-ink-soft @md:text-xl">
                {/* Each phrase stays on one line where it fits, so the line breaks after the comma. */}
                <span className="inline-block">Order ahead with any AI assistant,</span>{' '}
                <span className="inline-block">pay with PayPal</span>
              </p>
            </header>

            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 py-4">
              <div
                role="img"
                aria-label={`QR code that opens ${asTyped(shopUrl)}`}
                data-testid="card-qr"
                className={cx('aspect-square [&>svg]:block [&>svg]:size-full', shop.coverUrl ? 'w-[46%]' : 'w-3/5')}
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="mt-1 type-heading">Scan for the menu</p>
              <p className="type-price text-sm text-ink-soft [overflow-wrap:anywhere]" data-testid="card-shop-url">
                {asTyped(shopUrl)}
              </p>
            </div>

            <footer className="flex w-full items-end justify-between gap-4 border-t border-line pt-3 text-left">
              <p className="min-w-0 type-meta text-ink-soft">
                <span className="font-semibold text-ink">Agent door</span> for AI assistants
                <span className="block type-price text-ink [overflow-wrap:anywhere]" data-testid="card-door-url">
                  {doorUrl}
                </span>
              </p>
              <Logo size="sm" className="shrink-0" />
            </footer>
          </div>
        </article>
        <p className="type-meta text-ink-muted print:hidden">Prints 5 × 7 inches on letter or A4 paper. Cut along the edge.</p>
        </div>
      )}
    </div>
  );
}
