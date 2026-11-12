// Counter card: a 5 × 7 in card for the counter. Its QR code opens the shop page, which carries the
// agent door; the door's address is printed small for anyone setting up an assistant by hand. Owner only, outside the
// dashboard's tabs; printing shows the card alone (globals.css, `data-print-alone`). A draft shop has no card yet: its
// `draft-xxxxxxxx` address is replaced at first publish, so a card printed before then would never open the shop.
import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { CounterCard } from '@/components/dashboard/CounterCard';
import { Icon } from '@/components/ui/icon';
import { getOwnedShop, requireOwner } from '@/lib/auth/owner';
import { getConfig } from '@/lib/config';
import { qrSvg } from '@/lib/discovery/qr';
import { PrintButton } from './PrintButton';

export async function generateMetadata({ params }: PageProps<'/shops/[id]/card'>): Promise<Metadata> {
  const { id } = await params;
  const shop = await getOwnedShop(id).catch(() => null);
  return { title: shop ? `Counter card · ${shop.name} · Shelfie` : 'Counter card · Shelfie', robots: { index: false } };
}

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
        <CounterCard name={shop.name} coverUrl={shop.coverUrl} shopUrl={shopUrl} doorUrl={doorUrl} qr={qr} />
        <p className="type-meta text-ink-muted print:hidden">Prints 5 × 7 inches on letter or A4 paper. Cut along the edge.</p>
        </div>
      )}
    </div>
  );
}
