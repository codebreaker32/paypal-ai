'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/app/PageHeader';
import { switchSection } from '@/components/app/SectionLink';
import { patchShell, shellSnapshot, useShellValues, type ShellValues } from '@/components/app/shell-store';
import { itemPictures, pictureSource } from '@/lib/library/picture';
import { listedItems } from '@/lib/domain/listed';
import { FieldError } from '@/components/ui/field';
import { TextLink } from '@/components/ui/text-link';
import { useToast } from '@/components/ui/toast';
import { formatUSD } from '@/lib/domain/money';
import { canBePaid } from '@/lib/domain/payee';
import type { ItemWithVariants, Order, ShopKind, ShopStatus } from '@/lib/domain/types';
import { menuSummary, sectionFromTab, sectionHref, sectionLabel, sectionTitle } from '@/lib/seller/shell-view';
import { buyerLabel, mergePolledOrders, whereLabel } from '@/lib/seller/view';
import { POLL_MS, fetchOrders, setShopStatus } from './api';
import { newlyPaid } from './new-orders';
import { MenuPanel } from './MenuPanel';
import { OrdersPanel } from './OrdersPanel';
import { SettingsPanel } from './SettingsPanel';
import { SharePanel } from './SharePanel';
import { Switch } from './Switch';

export interface DashboardProps {
  /** `payeeEmail`: where buyers' money goes (owner only); `isDemo`: Shelfie's demo shop, which may have none. */
  shop: {
    id: string; name: string; slug: string; status: ShopStatus; payeeEmail: string | null; isDemo: boolean; coverUrl?: string | null;
    /** The shop's logo and kind: the logo also shows in the shell. */
    logoUrl?: string | null; kind?: ShopKind;
  };
  initialOrders: Order[];
  initialItems: ItemWithVariants[];
  initialPaypalReachable: boolean;
  appUrl: string;
  /** The counter card's QR code, as SVG markup (null for a draft, which has no address yet). */
  shareQr: string | null;
  /** The signed-in account's email, or null with no account (Settings). */
  accountEmail: string | null;
}

/** How long a just-arrived row keeps its rise and paid glow (the glow's CSS animation is 2.4 s). */
const FRESH_MS = 2600;

export function Dashboard({ shop, initialOrders, initialItems, initialPaypalReachable, appUrl, shareQr, accountEmail }: DashboardProps) {
  const toast = useToast();
  const section = sectionFromTab(useSearchParams().get('tab'));
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialItems);
  const [coverUrl, setCoverUrl] = useState(shop.coverUrl ?? null);
  const [logoUrl, setLogoUrl] = useState(shop.logoUrl ?? null);
  const kind = shop.kind ?? 'food';
  const [paypalReachable, setPaypalReachable] = useState(initialPaypalReachable);
  // Status lives in the shell's store: its banner can resume the shop from any section.
  const [serverShell] = useState<ShellValues>(() => ({
    toPrepare: initialOrders.filter((o) => o.status === 'paid').length,
    status: shop.status,
    logoUrl: shop.logoUrl ?? null,
    coverUrl: shop.coverUrl ?? null,
    payeeMissing: !canBePaid({ slug: shop.slug, payeeEmail: shop.payeeEmail }),
    paypalDown: !initialPaypalReachable,
    recoveryUnsaved: false,
  }));
  const status = useShellValues(shop.id, serverShell).status;
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

  const togglePause = async (paused: boolean) => {
    const before = status;
    const wanted = paused ? 'paused' : 'live';
    setPausing(true);
    setPauseError(null);
    patchShell(shop.id, { status: wanted });
    // A slow answer must not undo what came after it: the banner's Resume can change the status while this is in flight.
    const stillWanted = () => shellSnapshot(shop.id, serverShell).status === wanted;
    try {
      const { shop: saved } = await setShopStatus(shop.id, wanted);
      if (stillWanted()) patchShell(shop.id, { status: saved.status });
    } catch (e) {
      if (stillWanted()) patchShell(shop.id, { status: before });
      setPauseError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setPausing(false);
    }
  };

  const toPrepare = orders.filter((o) => o.status === 'paid').length;
  const payeeMissing = !canBePaid({ slug: shop.slug, payeeEmail });
  const photos = itemPictures(items, kind);
  const paused = status === 'paused';

  // The shell reads these; a change here (a poll, an upload, a save) reaches it without touching this tree.
  useEffect(() => {
    patchShell(shop.id, { toPrepare, coverUrl, logoUrl, payeeMissing, paypalDown: !paypalReachable });
  }, [shop.id, toPrepare, coverUrl, logoUrl, payeeMissing, paypalReachable]);

  // Back and Forward change the section too, so the tab's title follows the URL rather than the click.
  useEffect(() => {
    document.title = sectionTitle(section, shop.name);
  }, [section, shop.name]);

  const listed = listedItems(items);
  const sources = listed.map((i) => pictureSource(photos.get(i.id)!));
  const header =
    section === 'orders' ? (
      <PageHeader
        title="Orders"
        actions={
          status !== 'draft' ? (
            <div className="flex flex-col items-end">
              <Switch inline label="Pause agent orders" checked={paused} busy={pausing} failed={!!pauseError} onChange={togglePause} />
              {pauseError && <FieldError className="max-w-56 pb-2 text-right">{pauseError}</FieldError>}
            </div>
          ) : undefined
        }
      />
    ) : section === 'menu' ? (
      <PageHeader
        title="Menu"
        description={<span className="type-figures">{menuSummary({ total: listed.length, own: sources.filter((s) => s === 'own').length, examples: sources.filter((s) => s === 'example').length })}</span>}
        actions={shop.slug ? <TextLink href={`/s/${shop.slug}`}>See it on your shop</TextLink> : undefined}
      />
    ) : (
      <PageHeader title={sectionLabel(section)} />
    );

  return (
    <div className="flex flex-col">
      {header}

      {pollFailures >= 2 && (
        <p role="status" className="pb-4 type-meta text-ink-muted">
          Can’t reach Shelfie to refresh orders. Retrying every few seconds.
        </p>
      )}

      <div id={`section-panel-${section}`} data-section-panel="">
        {section === 'orders' && (
          <OrdersPanel
            orders={orders}
            shopId={shop.id}
            slug={shop.slug}
            fresh={fresh}
            justPaid={justPaid}
            photos={photos}
            shopKind={kind}
            onOrderChange={onOrderChange}
            onShowShare={() => switchSection(sectionHref(shop.id, 'share'))}
          />
        )}
        {section === 'menu' && (
          <MenuPanel items={items} shopId={shop.id} shopKind={kind} shopName={shop.name} coverUrl={coverUrl} onItemsChange={setItems} onCoverChange={setCoverUrl} />
        )}
        {section === 'share' && <SharePanel shopId={shop.id} status={status} shopUrl={`${appUrl}/s/${shop.slug}`} doorUrl={`${appUrl}/s/${shop.slug}/mcp`} slug={shop.slug} qr={shareQr} />}
        {section === 'settings' && (
          <SettingsPanel
            shopId={shop.id}
            shopName={shop.name}
            payeeEmail={payeeEmail}
            isDemo={shop.isDemo}
            draft={status === 'draft'}
            onSaved={setPayeeEmail}
            logoUrl={logoUrl}
            onLogoChange={setLogoUrl}
            accountEmail={accountEmail}
          />
        )}
      </div>
    </div>
  );
}
