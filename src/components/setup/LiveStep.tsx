'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Bot, Check, ChevronDown, CircleCheck, Copy, DoorOpen, ExternalLink, KeyRound, LayoutDashboard, PauseCircle, RotateCcw, Store, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { PublishProgress, usePublish } from './Publishing';

export interface LiveProps {
  shopId: string;
  name: string;
  slug: string;
  status: 'live' | 'paused' | 'draft';
  shopUrl: string;
  agentDoorUrl: string;
  /** Null when this browser was given the shop without its owner cookie value (shouldn't happen). */
  ownerLink: string | null;
  liveCount: number;
  inPersonCount: number;
  pendingCount: number;
  /** Names of the items still waiting for PayPal (a publish that partly failed). */
  pendingNames: string[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A link shown in full (it wraps), with a Copy button that confirms in place and with a toast. */
function CopyRow({
  value,
  label,
  copyLabel = 'Copy link',
  mono,
  primary,
}: {
  value: string;
  label: string;
  copyLabel?: string;
  mono?: boolean;
  /** The screen's one primary action. */
  primary?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <code
        id={id}
        className={cx(
          'flex min-h-(--field-h) flex-1 items-center rounded-md border border-line-strong bg-surface-sunken px-3.5 py-2 text-sm [overflow-wrap:anywhere]',
          mono ? 'font-mono' : 'font-sans',
        )}
      >
        {value}
      </code>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        size={primary ? 'lg' : 'md'}
        icon={copied ? Check : Copy}
        aria-describedby={id}
        onClick={async () => {
          const ok = await copyText(value);
          setCopied(ok);
          toast(ok ? { title: `${label} copied`, tone: 'ok' } : { title: "Couldn’t copy", description: 'Select the text and copy it yourself.', tone: 'danger' });
        }}
      >
        {copied ? 'Copied' : copyLabel}
      </Button>
    </div>
  );
}

function LinkCard({ icon, title, className, children }: { icon: LucideIcon; title: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} className={cx('flex min-w-0 flex-col gap-3', className)}>
      <h2 id={id} className="flex items-center gap-2 type-heading">
        <Icon icon={icon} className="text-ink-soft" />
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** "Your shop is live": the links to share, the one thing to try next, and the owner link. */
export function LiveStep(p: LiveProps) {
  const router = useRouter();
  const { run, start } = usePublish(p.shopId);
  const claudeCommand = `claude mcp add --transport http ${p.slug} ${p.agentDoorUrl}`;
  const retry = async () => {
    const r = await start();
    if (r.phase === 'done') router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-10 px-gutter pt-8 pb-section lg:pt-12">
      <header className="flex max-w-measure flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {p.status === 'paused' ? (
            <Badge tone="warn" icon={PauseCircle}>
              Paused
            </Badge>
          ) : (
            <Badge tone="ok" icon={CircleCheck}>
              Live
            </Badge>
          )}
          <span className="type-meta text-ink-muted">{p.name}</span>
        </div>
        <h1 className="type-display">{p.status === 'paused' ? 'Your shop is paused' : 'Your shop is live'}</h1>
        <p className="type-lead text-ink-soft">
          {p.liveCount} {p.liveCount === 1 ? 'item is' : 'items are'} in your PayPal catalog
          {p.inPersonCount > 0 && <>, plus {p.inPersonCount} to ask about in person</>}. Any AI assistant can order from
          you now, and buyers pay on PayPal.
        </p>
      </header>

      {p.pendingCount > 0 && (
        <Card as="section" aria-labelledby="pending-title" className="flex max-w-measure flex-col gap-4">
          <h2 id="pending-title" className="flex items-center gap-2 font-semibold text-warn">
            <Icon icon={TriangleAlert} />
            {p.pendingCount} {p.pendingCount === 1 ? 'item hasn’t' : 'items haven’t'} reached PayPal yet
          </h2>
          {run.phase === 'idle' ? (
            <p className="text-ink-soft">
              {p.pendingNames.join(', ')} {p.pendingCount === 1 ? 'is' : 'are'} ready but PayPal didn’t take {p.pendingCount === 1 ? 'it' : 'them'} last
              time. Your shop is open without {p.pendingCount === 1 ? 'it' : 'them'} until then.
            </p>
          ) : (
            <PublishProgress run={run} />
          )}
          <Button variant="secondary" icon={RotateCcw} loading={run.phase === 'running'} loadingLabel="Retrying…" onClick={() => void retry()} className="self-start">
            Retry {p.pendingCount} {p.pendingCount === 1 ? 'item' : 'items'}
          </Button>
        </Card>
      )}

      {/* The primary action, Copy agent door link, comes first on phones; then the next step to try, then the rest.
          Desktop: the links on the left, the next step and the owner link on the right. */}
      {/* grid-cols-1 is minmax(0, 1fr): a long link or command wraps inside its card instead of widening the column. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-4">
        <LinkCard icon={DoorOpen} title="Agent door" className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <p className="text-ink-soft">
            Give this link to any AI assistant. It can read your menu and place orders for people, who then pay on PayPal.
          </p>
          <CopyRow value={p.agentDoorUrl} label="Agent door link" copyLabel="Copy agent door link" primary />
        </LinkCard>

        <Card as="section" aria-labelledby="try-title" tone="sunken" className="flex min-w-0 flex-col gap-4 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <h2 id="try-title" className="flex items-center gap-2 type-heading">
            <Icon icon={Bot} className="text-ink-soft" />
            See it work
          </h2>
          <p className="text-ink-soft">An AI assistant that has never seen your menu orders from it through the agent door. You watch every step.</p>
          <ButtonLink href={`/s/${p.slug}?assistant=1`} size="lg" icon={Bot} fullWidth>
            Watch an AI order from you
          </ButtonLink>
          <ButtonLink href={`/shops/${p.shopId}`} icon={LayoutDashboard} fullWidth>
            Open your dashboard
          </ButtonLink>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-2">
          <LinkCard icon={Store} title="Shop link">
            <p className="text-ink-soft">Your menu for people to read, with a button to order through an assistant.</p>
            <CopyRow value={p.shopUrl} label="Shop link" />
            <Link
              href={`/s/${p.slug}`}
              className="-my-1 inline-flex min-h-tap items-center gap-1.5 self-start font-semibold text-accent-ink underline decoration-accent-hover hover:decoration-ink"
            >
              Open your shop <Icon icon={ExternalLink} size="sm" />
            </Link>
          </LinkCard>

          <details className="group rounded-lg border border-line-strong bg-surface-raised">
            <summary className="flex min-h-tap list-none items-center gap-3 px-4 py-2.5 font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex-1">For developers</span>
              <Icon icon={ChevronDown} className="text-ink-soft transition-transform duration-(--duration-fast) group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-sm text-ink-soft">
              <p>
                The agent door is an MCP server (Streamable HTTP, no sign-in) with four tools: <code className="font-mono">get_shop_info</code>,{' '}
                <code className="font-mono">list_products</code>, <code className="font-mono">create_order</code> and{' '}
                <code className="font-mono">get_order_status</code>. Prices always come from the shop.
              </p>
              <p>Add it to Claude Code:</p>
              <CopyRow value={claudeCommand} label="Command" copyLabel="Copy command" mono />
            </div>
          </details>
        </div>

        {p.ownerLink && (
          <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-3">
            <LinkCard icon={KeyRound} title="Your owner link">
              <p className="text-ink-soft">Open your shop on another phone. Keep this link private: anyone with it can run your shop.</p>
              <CopyRow value={p.ownerLink} label="Owner link" mono />
            </LinkCard>
          </div>
        )}
      </div>
    </div>
  );
}
