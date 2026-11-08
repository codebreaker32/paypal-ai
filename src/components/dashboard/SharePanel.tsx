'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ExternalLink, Printer } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Icon } from '@/components/ui/icon';
import { PANEL_ROW, PanelList, PanelRow } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import type { ShopStatus } from '@/lib/domain/types';

export interface SharePanelProps {
  shopId: string;
  /** Live or paused shops have a web address; a draft's is replaced at first publish, so it never reaches this panel. */
  status: ShopStatus;
  shopUrl: string;
  doorUrl: string;
  slug: string;
  /** The counter card's QR code, as SVG markup (null for a draft). */
  qr: string | null;
}

/** The link as people type it: "https://shelfie.example/s/rosa" → "shelfie.example/s/rosa". */
const asTyped = (url: string) => url.replace(/^https?:\/\//, '');

/** A link's row: its name, at most one line on what it's for, then the URL as plain text. */
function LinkRowBody({ id, title, detail, url }: { id: string; title: string; detail?: ReactNode; url: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="type-section">{title}</h2>
      {detail && <p className="text-sm text-ink-soft">{detail}</p>}
      <p className="type-price text-sm text-ink-soft [overflow-wrap:anywhere]" data-testid={id}>
        {url}
      </p>
    </div>
  );
}

const ROW_ACTION = 'w-full @xl:w-auto';

/** The MCP details: only someone wiring up an assistant by hand needs them, so they stay folded. */
function ForDevelopers({ slug, doorUrl }: { slug: string; doorUrl: string }) {
  const command = `claude mcp add --transport http ${slug} ${doorUrl}`;
  return (
    <li>
      <details className="group">
        <summary className={cn('press-surface group/summary flex list-none items-center gap-3 outline-none hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden', PANEL_ROW)}>
          <span className="type-section flex-1">For developers</span>
          <Icon icon={ChevronDown} className="text-ink-muted transition-[rotate,color] duration-(--duration-fast) group-open:rotate-180 group-hover/summary:text-ink" />
        </summary>
        <div className="flex flex-col gap-3 px-(--row-pad-x) pb-(--row-pad-y) text-sm text-ink-soft">
          <p>
            The agent door is an MCP server (Streamable HTTP, no sign-in) with four tools: <code className="font-mono">get_shop_info</code>,{' '}
            <code className="font-mono">list_products</code>, <code className="font-mono">create_order</code> and{' '}
            <code className="font-mono">get_order_status</code>. Prices always come from the shop.
          </p>
          <p>Add it to Claude Code:</p>
          <div className="flex flex-col gap-2 @xl:flex-row @xl:items-center">
            <code className="min-w-0 flex-1 rounded-(--field-radius) bg-surface-sunken px-3.5 py-2 font-mono text-sm [overflow-wrap:anywhere]">{command}</code>
            <CopyButton text={command} what="Command" label="Copy command" className={ROW_ACTION} />
          </div>
        </div>
      </details>
    </li>
  );
}

export function SharePanel({ shopId, status, shopUrl, doorUrl, slug, qr }: SharePanelProps) {
  if (status === 'draft' || qr === null) {
    return (
      <div className="flex max-w-measure flex-col items-start gap-3">
        <p className="text-ink-soft">Your shop gets its web address when you publish.</p>
        <ButtonLink href={`/shops/${shopId}/setup`}>Finish setting up</ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
      <PanelList className="min-w-0">
        <PanelRow action={<CopyButton text={doorUrl} what="Agent door link" label="Copy agent door link" primary className={ROW_ACTION} />}>
          <LinkRowBody id="share-door-url" title="Your agent door" detail="Give it to any AI assistant to order from you." url={doorUrl} />
        </PanelRow>
        <PanelRow
          action={
            <div className="flex gap-2">
              <CopyButton text={shopUrl} what="Shop link" className="flex-1 @xl:flex-none" />
              <ButtonLink href={`/s/${slug}`} variant="ghost" icon={ExternalLink} className="flex-1 @xl:flex-none">
                Open
              </ButtonLink>
            </div>
          }
        >
          <LinkRowBody id="share-shop-url" title="Your shop link" url={shopUrl} />
        </PanelRow>
        <PanelRow action={<ButtonLink href={`/s/${slug}?assistant=1`} variant="secondary" className={ROW_ACTION}>Watch an AI order from you</ButtonLink>}>
          <h2 className="type-section">Try your shop</h2>
        </PanelRow>
        <ForDevelopers slug={slug} doorUrl={doorUrl} />
      </PanelList>

      <Card as="section" aria-label="Counter card" className="flex flex-col items-center gap-4">
        <div
          role="img"
          aria-label={`QR code that opens ${asTyped(shopUrl)}`}
          data-testid="share-qr"
          className="size-40 [&>svg]:block [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <ButtonLink href={`/shops/${shopId}/card`} variant="secondary" icon={Printer} fullWidth>
          Print counter card
        </ButtonLink>
      </Card>
    </div>
  );
}
