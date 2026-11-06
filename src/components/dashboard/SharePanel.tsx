'use client';

import { Bot, DoorOpen, ExternalLink, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { CopyButton } from './CopyButton';

function LinkBlock({
  id,
  icon,
  title,
  children,
  url,
  what,
  copyLabel,
  openHref,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  url: string;
  what: string;
  /** Spelled-out copy action; set on the one block whose copy is the screen's primary action. */
  copyLabel?: string;
  openHref?: string;
}) {
  return (
    <Card as="section" aria-labelledby={id} padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
          <Icon icon={icon} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={id} className="type-heading">
            {title}
          </h2>
          <p className="max-w-measure text-ink-soft">{children}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p
          className="type-price min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm font-medium [overflow-wrap:anywhere]"
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
    </Card>
  );
}

export function SharePanel({ shopUrl, doorUrl, slug }: { shopUrl: string; doorUrl: string; slug: string }) {
  return (
    <div className="flex flex-col gap-5">
      <LinkBlock id="share-door" icon={DoorOpen} title="Your agent door" url={doorUrl} what="Agent door link" copyLabel="Copy agent door link">
        Your agent door is a link any AI assistant can use to read your menu and place an order, which the buyer then approves and pays for on PayPal.
      </LinkBlock>
      <LinkBlock id="share-shop" icon={Store} title="Your shop link" url={shopUrl} what="Shop link" openHref={`/s/${slug}`}>
        Your menu for people to read, with the agent door on it. Put it in your bio or next to your price list.
      </LinkBlock>
      <ButtonLink href={`/s/${slug}?assistant=1`} variant="secondary" icon={Bot} className="w-full sm:w-auto sm:self-start">
        Watch an AI order from you
      </ButtonLink>
    </div>
  );
}
