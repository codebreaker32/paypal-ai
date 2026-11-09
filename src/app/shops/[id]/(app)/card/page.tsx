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
import { cardNameSize } from './name-size';
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
          {/* Every size is a share of the card's width (cqw), so the preview at any width and the 5 in print are one layout.
              The QR takes the height that's left: a long name makes it smaller, never pushes the footer off the card. */}
          <div className={cx('flex min-h-0 w-full flex-1 flex-col items-center px-[8.3cqw] pb-[5.8cqw]', shop.coverUrl ? 'pt-[5.8cqw]' : 'pt-[10cqw]')}>
            <header className="flex flex-col items-center gap-[2.5cqw]">
              <h2
                id="card-shop-name"
                className={cx('line-clamp-3 font-display leading-[1.04] font-extrabold tracking-display [overflow-wrap:anywhere]', cardNameSize(shop.name))}
              >
                {shop.name}
              </h2>
              <p className="text-[4.15cqw] leading-snug text-ink-soft">
                {/* Each phrase stays on one line where it fits, so the line breaks after the comma. */}
                <span className="inline-block">Order ahead with any AI assistant,</span>{' '}
                <span className="inline-block">pay with PayPal</span>
              </p>
            </header>

            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[1.2cqw] py-[3.3cqw]">
              <div className="relative min-h-0 w-full flex-1">
                <div
                  role="img"
                  aria-label={`QR code that opens ${asTyped(shopUrl)}`}
                  data-testid="card-qr"
                  className="absolute inset-0 [&>svg]:block [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              </div>
              <p className="mt-[0.8cqw] font-display text-[3.75cqw] leading-snug font-bold">Scan for the menu</p>
              <p className="type-price text-[2.9cqw] text-ink-soft [overflow-wrap:anywhere]" data-testid="card-shop-url">
                {asTyped(shopUrl)}
              </p>
            </div>

            <footer className="flex w-full items-end justify-between gap-[3.3cqw] border-t border-line pt-[2.5cqw] text-left text-[2.7cqw] leading-snug">
              <p className="min-w-0 text-ink-soft">
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
