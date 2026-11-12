'use client';

import { useRouter } from 'next/navigation';
import { useSyncExternalStore, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { ExternalLink, Printer, RotateCcw, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { useShellValues, type ShellValues } from '@/components/app/shell-store';
import { EASE_OUT, MOTION_S } from '@/components/motion/tokens';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { ShopAvatar, type ShopAvatarProps } from '@/components/shop/ShopAvatar';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Icon } from '@/components/ui/icon';
import { PanelList, PanelRow } from '@/components/ui/panel';
import { TextLink } from '@/components/ui/text-link';
import { pictureSource } from '@/lib/library/picture';
import type { LivePreview, LivePreviewRow } from '@/lib/seller/live-preview';
import { ShopStatusBadge } from '@/components/dashboard/shop-status';
import { shopStatusWord } from '@/lib/seller/shell-view';
import { PublishProgress, usePublish } from './Publishing';

export interface LiveProps {
  shopId: string;
  name: string;
  slug: string;
  /** What the server read; the banner's Resume changes it through the shell's store. */
  shell: ShellValues;
  shopUrl: string;
  agentDoorUrl: string;
  liveCount: number;
  inPersonCount: number;
  pendingCount: number;
  /** Names of the items still waiting for PayPal (a publish that partly failed). */
  pendingNames: string[];
  /** The shop's picture beside its name (`ShopAvatar`): never letters. */
  avatar: Pick<ShopAvatarProps, 'shop' | 'items'>;
  preview: LivePreview;
}

const subscribeNothing = () => () => {};

/**
 * The one celebratory beat: when the shop goes live in this browser (the step mounts after publishing), the preview of
 * it scales in. A direct load paints at once (server HTML is never hidden). Reduced motion keeps only the fade.
 */
function LiveBeat({ className, children }: { className?: string; children: ReactNode }) {
  const clientMount = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [initial] = useState(clientMount ? { opacity: 0, scale: 0.94 } : false);
  return (
    <m.div
      data-entrance=""
      className={className}
      initial={initial}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION_S.slow, ease: EASE_OUT }}
    >
      {children}
    </m.div>
  );
}


/* eslint-disable @next/next/no-img-element -- the shop's cover: a site-relative upload or bundled photo of unknown size */
function PreviewHero({ hero, shopName }: { hero: NonNullable<LivePreview['hero']>; shopName: string }) {
  if (hero.kind === 'cover') return <img src={hero.src} alt={`${shopName} cover`} className="size-full object-cover" />;
  return <ItemPhoto name={hero.item.name} {...hero.item.picture} className="size-full" />;
}
/* eslint-enable @next/next/no-img-element */

function PreviewRow({ row }: { row: LivePreviewRow }) {
  return (
    <li className="flex items-center gap-3">
      <ItemPhoto name={row.name} {...row.picture} decorative className="size-10 shrink-0 rounded-(--thumb-radius)" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={row.name}>
        {row.name}
      </span>
      <span className="type-price shrink-0 text-sm font-semibold">{row.price}</span>
    </li>
  );
}

/** The shop itself, as a card. Below xl it is a compact strip above the rows, without the picture and items. */
function ShopPreview({ p, status }: { p: LiveProps; status: ReturnType<typeof shopStatusWord> }) {
  const { hero, rows } = p.preview;
  const example = hero?.kind === 'item' && pictureSource(hero.item.picture) === 'example';
  return (
    <LiveBeat className="order-first min-w-0 origin-center xl:order-none">
      <Card padding="none" className="overflow-hidden" data-testid="live-preview">
        {hero && (
          <div className="relative hidden aspect-video xl:block">
            <PreviewHero hero={hero} shopName={p.name} />
            {example && <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 type-meta font-semibold text-surface">Example photo</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 p-4 xl:p-5">
          <ShopAvatar {...p.avatar} size="sm" />
          <div className="min-w-0 flex-1 basis-0">
            <p className="font-bold [overflow-wrap:anywhere]">{p.name}</p>
            <ShopStatusBadge tone={status.tone} word={status.word} />
          </div>
          {rows.length > 0 && <ul className="hidden w-full flex-col gap-3 border-t border-line pt-4 xl:flex">{rows.map((row) => <PreviewRow key={row.id} row={row} />)}</ul>}
          <TextLink href={`/s/${p.slug}`} className="shrink-0 text-sm">
            Open your shop <Icon icon={ExternalLink} size="sm" />
          </TextLink>
        </div>
      </Card>
    </LiveBeat>
  );
}

function RowHeading({ children }: { children: ReactNode }) {
  return <h3 className="type-section">{children}</h3>;
}

const RowUrl = ({ children }: { children: string }) => <p className="text-sm text-ink-soft [overflow-wrap:anywhere]">{children}</p>;

/** The width of a row's action: its own under the text at @xl, the whole row on a narrow list. */
const ROW_ACTION = 'w-full @xl:w-auto';

/** "Your shop is live": the shop itself beside the few things to do with it now. */
export function LiveStep(p: LiveProps) {
  const router = useRouter();
  const { run, start } = usePublish(p.shopId);
  const { status, payeeMissing } = useShellValues(p.shopId, p.shell);
  const retry = async () => {
    const r = await start();
    if (r.phase === 'done') router.refresh();
  };

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={status === 'paused' ? 'Your shop is paused' : 'Your shop is live'}
        description={
          <>
            {p.liveCount} {p.liveCount === 1 ? 'item is' : 'items are'} in your PayPal catalog
            {p.inPersonCount > 0 && <>, plus {p.inPersonCount} to ask about in person</>}.
          </>
        }
        actions={
          // Below xl the compact preview right under this header carries the same link, so one is enough.
          <ButtonLink href={`/s/${p.slug}`} variant="secondary" icon={ExternalLink} className="max-xl:hidden">
            Open your shop
          </ButtonLink>
        }
      />

      {p.pendingCount > 0 && (
        <section aria-labelledby="pending-title" className="mb-6 flex flex-col gap-3 rounded-(--card-radius) bg-warn-soft p-5">
          <h2 id="pending-title" className="flex items-center gap-2 font-semibold text-warn">
            <Icon icon={TriangleAlert} />
            {p.pendingCount} {p.pendingCount === 1 ? 'item hasn’t' : 'items haven’t'} reached PayPal yet
          </h2>
          {run.phase === 'idle' ? (
            <p className="text-ink">
              {p.pendingNames.join(', ')} {p.pendingCount === 1 ? 'is' : 'are'} ready but PayPal didn’t take {p.pendingCount === 1 ? 'it' : 'them'} last
              time. Your shop is open without {p.pendingCount === 1 ? 'it' : 'them'} until then.
            </p>
          ) : (
            <PublishProgress run={run} />
          )}
          <Button variant="secondary" icon={RotateCcw} loading={run.phase === 'running'} loadingLabel="Retrying…" onClick={() => void retry()} className="self-start">
            Retry {p.pendingCount} {p.pendingCount === 1 ? 'item' : 'items'}
          </Button>
        </section>
      )}

      {/* Rows first in the markup (left on desktop, read first); the compact preview moves above them on narrow screens. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <section aria-labelledby="live-next" className="min-w-0">
          <h2 id="live-next" className="sr-only">
            What to do next
          </h2>
          <PanelList>
            <PanelRow action={<ButtonLink href={`/s/${p.slug}?assistant=1`} variant="primary" className={ROW_ACTION}>Watch an AI order from you</ButtonLink>}>
              <RowHeading>Try your shop</RowHeading>
            </PanelRow>
            <PanelRow action={<CopyButton text={p.agentDoorUrl} what="Agent door link" label="Copy agent door link" className={ROW_ACTION} />}>
              <div className="flex flex-col gap-1">
                <RowHeading>Your agent door</RowHeading>
                <p className="text-sm text-ink-soft">Give it to any AI assistant to order from you. It is not a web page: share your shop link with people.</p>
                <RowUrl>{p.agentDoorUrl}</RowUrl>
              </div>
            </PanelRow>
            <PanelRow action={<CopyButton text={p.shopUrl} what="Shop link" label="Copy link" className={ROW_ACTION} />}>
              <div className="flex flex-col gap-1">
                <RowHeading>Your shop link</RowHeading>
                <RowUrl>{p.shopUrl}</RowUrl>
              </div>
            </PanelRow>
            <PanelRow
              action={
                <ButtonLink href={`/shops/${p.shopId}/card`} variant="secondary" icon={Printer} className={ROW_ACTION}>
                  Print counter card
                </ButtonLink>
              }
            >
              <RowHeading>Counter card</RowHeading>
            </PanelRow>
          </PanelList>
        </section>

        <ShopPreview p={p} status={shopStatusWord(status, payeeMissing)} />
      </div>
    </div>
  );
}
