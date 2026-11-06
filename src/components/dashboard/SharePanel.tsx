'use client';

import type { ReactNode } from 'react';
import { Bot, ExternalLink, Printer } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { CopyButton } from './CopyButton';

/** One link to share: its heading, one line on what it's for, then the link with Copy (and Open). Divided, not boxed. */
function LinkBlock({
  id,
  title,
  children,
  url,
  what,
  copyLabel,
  openHref,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  url: string;
  what: string;
  /** Spelled-out copy action; set on the one block whose copy is the screen's primary action. */
  copyLabel?: string;
  openHref?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cx('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-heading">
          {title}
        </h2>
        <p className="max-w-measure text-ink-soft">{children}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p
          className="type-price flex min-h-(--field-h) min-w-0 flex-1 items-center rounded-(--field-radius) bg-surface-sunken px-3.5 py-2 text-sm font-medium [overflow-wrap:anywhere]"
          data-testid={`${id}-url`}
        >
          {url}
        </p>
        <div className="flex gap-2">
          <CopyButton text={url} what={what} label={copyLabel} primary={!!copyLabel} className="flex-1 sm:flex-none" />
          {openHref && (
            <ButtonLink href={openHref} variant="ghost" icon={ExternalLink} className="flex-1 sm:flex-none">
              Open
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}

export function SharePanel({ shopId, shopUrl, doorUrl, slug }: { shopId: string; shopUrl: string; doorUrl: string; slug: string }) {
  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <div className="flex min-w-0 flex-col gap-8">
        <LinkBlock id="share-door" title="Your agent door" url={doorUrl} what="Agent door link" copyLabel="Copy agent door link">
          Any AI assistant can read your menu and order through it. The buyer approves and pays on PayPal.
        </LinkBlock>
        <LinkBlock id="share-shop" title="Your shop link" url={shopUrl} what="Shop link" openHref={`/s/${slug}`} className="border-t border-line pt-8">
          Your menu for people, with the agent door on it. Put it in your bio.
        </LinkBlock>
      </div>

      <div className="flex flex-col gap-4">
        {/* The counter card: a printable card with a QR code of the shop link (its own page, /shops/[id]/card). */}
        <section aria-labelledby="share-card" className="flex flex-col items-start gap-3 rounded-(--card-radius) bg-surface-sunken p-5">
          <h2 id="share-card" className="type-heading">
            Counter card
          </h2>
          <p className="text-ink-soft">A QR code of your shop for the counter. Assistants find your agent door there too.</p>
          <ButtonLink href={`/shops/${shopId}/card`} variant="secondary" icon={Printer} className="w-full bg-surface hover:bg-line sm:w-auto">
            Print counter card
          </ButtonLink>
        </section>
        <ButtonLink href={`/s/${slug}?assistant=1`} variant="ghost" icon={Bot} className="w-full sm:w-auto sm:self-start">
          Watch an AI order from you
        </ButtonLink>
      </div>
    </div>
  );
}
