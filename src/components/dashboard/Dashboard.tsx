'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { LogoPicker } from '@/components/setup/PhotoPicker';
import { itemPictures } from '@/lib/library/picture';
import { listedItems } from '@/lib/domain/listed';
import { FieldError } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatUSD } from '@/lib/domain/money';
import { canBePaid } from '@/lib/domain/payee';
import type { ItemWithVariants, Order, ShopKind, ShopStatus } from '@/lib/domain/types';
import { buyerLabel, mergePolledOrders, whereLabel } from '@/lib/seller/view';
import { POLL_MS, fetchOrders, setShopStatus } from './api';
import { newlyPaid } from './new-orders';
import { MenuPanel } from './MenuPanel';
import { OrdersPanel } from './OrdersPanel';
import { SettingsPanel } from './SettingsPanel';
import { SharePanel } from './SharePanel';
import { Switch } from './Switch';

export type DashboardTab = 'orders' | 'menu' | 'share' | 'settings';

export interface DashboardProps {
  /** `payeeEmail`: where buyers' money goes (owner only); `isDemo`: Shelfie's demo shop, which may have none. */
  shop: {
    id: string; name: string; slug: string; status: ShopStatus; payeeEmail: string | null; isDemo: boolean; coverUrl?: string | null;
    /** For the header's picture (`ShopAvatar`): its logo, the kind and where its first menu photo is shown from, if any. */
    logoUrl?: string | null; kind?: ShopKind; menuPhotoSrc?: string | null;
  };
  initialOrders: Order[];
  initialItems: ItemWithVariants[];
  initialPaypalReachable: boolean;
  appUrl: string;
  initialTab: DashboardTab;
}

/** How long a just-arrived row keeps its rise and paid glow (the glow's CSS animation is 2.4 s). */
const FRESH_MS = 2600;

const STATUS_TONE = { ok: 'text-ok', warn: 'text-warn', neutral: 'text-ink-muted' } as const;

/** The shop's state as a dot and a word. */
function ShopStatusBadge({ status, payeeMissing }: { status: ShopStatus; payeeMissing: boolean }) {
  // A shop live from before payees existed takes no orders until it says where to be paid (spec §8a).
  const [tone, text] =
    status !== 'draft' && payeeMissing
      ? (['warn', 'Not taking orders: add your PayPal email'] as const)
      : status === 'live'
        ? (['ok', 'Live, taking orders'] as const)
        : status === 'paused'
          ? (['warn', 'Agent orders paused'] as const)
          : (['neutral', 'Not published yet'] as const);
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${STATUS_TONE[tone]}`}>
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function Dashboard({ shop, initialOrders, initialItems, initialPaypalReachable, appUrl, initialTab }: DashboardProps) {
  const toast = useToast();
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialItems);
  const [coverUrl, setCoverUrl] = useState(shop.coverUrl ?? null);
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? null);
  const kind = shop.kind ?? 'food';
  const [paypalReachable, setPaypalReachable] = useState(initialPaypalReachable);
  const [status, setStatus] = useState<ShopStatus>(shop.status);
  const [payeeEmail, setPayeeEmail] = useState(shop.payeeEmail);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [justPaid, setJustPaid] = useState<ReadonlySet<string>>(new Set());
  const [pollFailures, setPollFailures] = useState(0);
  const ordersRef = useRef(initialOrders);

  // Re-read our own API every 5 s (SQLite only). New orders rise in; an order the poll sees get paid also toasts and
  // glows for a moment. `ordersRef` starts as the orders the page rendered with, so nothing already paid toasts.
  const applyOrders = useCallback(
    (polled: Order[]) => {
      const prev = ordersRef.current;
      const next = mergePolledOrders(prev, polled);
      const seen = new Set(prev.map((o) => o.id));
      const paid = newlyPaid(prev, next);
      const arrived = [...next.filter((o) => !seen.has(o.id)).map((o) => o.id), ...paid.map((o) => o.id)];
      for (const o of paid) {
        toast({
          title: `New paid order ${o.number} · ${formatUSD(o.totalCents)}`,
          description: `${buyerLabel(o)} · ${whereLabel(o)}`,
          tone: 'ok',
          durationMs: 8000,
          action: { label: 'Open', href: `/shops/${shop.id}/orders/${o.id}` },
        });
      }
      ordersRef.current = next;
      setOrders(next);
      if (arrived.length) {
        const drop = (ids: string[]) => (all: ReadonlySet<string>) => new Set([...all].filter((id) => !ids.includes(id)));
        const paidIds = paid.map((o) => o.id);
        setFresh((all) => new Set([...all, ...arrived]));
        setJustPaid((all) => new Set([...all, ...paidIds]));
        // The highlight fades over 2.4 s (CSS); keep the flags a little longer so the animation is never cut.
        setTimeout(() => {
          setFresh(drop(arrived));
          setJustPaid(drop(paidIds));
        }, FRESH_MS);
      }
    },
    [toast, shop.id],
  );

  // A row that just got paid must not sit under the toast that announces it (on a phone the toast spans the screen's
  // foot): if the two overlap, scroll the row up clear of the toast, never pushing its top off screen.
  useEffect(() => {
    if (!justPaid.size) return;
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>('li[data-just-paid]');
      const region = document.querySelector<HTMLElement>('[data-toast-region]');
      if (!row || !region) return;
      const r = row.getBoundingClientRect();
      const t = region.getBoundingClientRect();
      if (!t.height || r.right <= t.left || r.left >= t.right) return;
      const by = Math.min(r.bottom - (t.top - 12), r.top - 8);
      if (by <= 0) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: by, behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [justPaid]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetchOrders(shop.id);
        if (stopped) return;
        applyOrders(r.orders);
        setPaypalReachable(r.paypalReachable !== false);
        setPollFailures(0);
      } catch {
        if (!stopped) setPollFailures((n) => n + 1);
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [shop.id, applyOrders]);

  const onOrderChange = (updated: Order) => {
    ordersRef.current = ordersRef.current.map((o) => (o.id === updated.id ? updated : o));
    setOrders(ordersRef.current);
  };

  const selectTab = (id: string) => {
    const next = id as DashboardTab;
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'orders') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  };

  const togglePause = async (paused: boolean) => {
    const before = status;
    setPausing(true);
    setPauseError(null);
    setStatus(paused ? 'paused' : 'live');
    try {
      const { shop: saved } = await setShopStatus(shop.id, paused ? 'paused' : 'live');
      setStatus(saved.status);
    } catch (e) {
      setStatus(before);
      setPauseError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setPausing(false);
    }
  };

  const toPrepare = orders.filter((o) => o.status === 'paid').length;
  const photos = itemPictures(items, kind);
  const paused = status === 'paused';

  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-6 px-gutter pt-6 pb-section lg:pt-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ShopAvatar
            shop={{ logoUrl, coverUrl, kind, menuPhotoSrc: shop.menuPhotoSrc ?? null }}
            items={listedItems(items)}
            className="hidden sm:block"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="type-display">{shop.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShopStatusBadge status={status} payeeMissing={!canBePaid({ slug: shop.slug, payeeEmail })} />
              {status !== 'draft' ? (
                <Link
                  href={`/s/${shop.slug}`}
                  className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
                >
                  View your shop <Icon icon={ExternalLink} size="sm" />
                </Link>
              ) : (
                <Link
                  href={`/shops/${shop.id}/setup`}
                  className="inline-flex min-h-tap items-center text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Finish setting up
                </Link>
              )}
            </div>
          </div>
        </div>
        {status !== 'draft' && (
          <div className="flex flex-col sm:items-end">
            <Switch
              inline
              label="Pause agent orders"
              description={paused ? 'Assistants can still read your menu.' : undefined}
              checked={paused}
              busy={pausing}
              failed={!!pauseError}
              onChange={togglePause}
            />
            {pauseError && <FieldError className="pb-2">{pauseError}</FieldError>}
          </div>
        )}
      </header>

      {pollFailures >= 2 && (
        <p role="status" className="type-meta text-ink-muted">
          Can’t reach Shelfie to refresh orders. Retrying every few seconds.
        </p>
      )}

      <Tabs
        label="Dashboard sections"
        value={tab}
        onValueChange={selectTab}
        items={[
          {
            id: 'orders',
            label: 'Orders',
            count: toPrepare > 0 ? toPrepare : undefined,
            content: (
              <OrdersPanel
                orders={orders}
                shopId={shop.id}
                slug={shop.slug}
                fresh={fresh}
                justPaid={justPaid}
                photos={photos}
                shopKind={kind}
                paypalReachable={paypalReachable}
                onOrderChange={onOrderChange}
                onShowShare={() => selectTab('share')}
              />
            ),
          },
          {
            id: 'menu',
            label: 'Menu',
            content: <MenuPanel items={items} shopId={shop.id} shopKind={kind} slug={shop.slug} shopName={shop.name} coverUrl={coverUrl} onItemsChange={setItems} onCoverChange={setCoverUrl} />,
          },
          {
            id: 'share',
            label: 'Share',
            content: <SharePanel shopId={shop.id} shopUrl={`${appUrl}/s/${shop.slug}`} doorUrl={`${appUrl}/s/${shop.slug}/mcp`} slug={shop.slug} />,
          },
          {
            id: 'settings',
            label: 'Settings',
            content: (
              <div className="flex flex-col gap-10">
                <SettingsPanel shopId={shop.id} payeeEmail={payeeEmail} isDemo={shop.isDemo} onSaved={setPayeeEmail} />
                <section aria-labelledby="settings-logo-title" className="flex max-w-measure flex-col gap-4 border-t border-line pt-8">
                  <h2 id="settings-logo-title" className="type-title">
                    Your logo
                  </h2>
                  <LogoPicker shopId={shop.id} shopName={shop.name} logoUrl={logoUrl} onChange={setLogoUrl} />
                </section>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
