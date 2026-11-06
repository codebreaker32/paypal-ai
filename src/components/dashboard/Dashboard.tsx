'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, CirclePause, ExternalLink, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { FieldError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants, Order, ShopStatus } from '@/lib/domain/types';
import { mergePolledOrders, whereLabel } from '@/lib/seller/view';
import { POLL_MS, fetchOrders, setShopStatus } from './api';
import { MenuPanel } from './MenuPanel';
import { OrdersPanel } from './OrdersPanel';
import { SharePanel } from './SharePanel';
import { Switch } from './Switch';

export type DashboardTab = 'orders' | 'menu' | 'share';

export interface DashboardProps {
  shop: { id: string; name: string; slug: string; status: ShopStatus };
  initialOrders: Order[];
  initialItems: ItemWithVariants[];
  initialPaypalReachable: boolean;
  appUrl: string;
  initialTab: DashboardTab;
}

function ShopStatusBadge({ status }: { status: ShopStatus }) {
  if (status === 'live') return <Badge tone="ok" icon={CircleCheck}>Live, taking orders</Badge>;
  if (status === 'paused') return <Badge tone="warn" icon={CirclePause}>Agent orders paused</Badge>;
  return <Badge icon={PencilLine}>Not published yet</Badge>;
}

export function Dashboard({ shop, initialOrders, initialItems, initialPaypalReachable, appUrl, initialTab }: DashboardProps) {
  const toast = useToast();
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialItems);
  const [paypalReachable, setPaypalReachable] = useState(initialPaypalReachable);
  const [status, setStatus] = useState<ShopStatus>(shop.status);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [pollFailures, setPollFailures] = useState(0);
  const ordersRef = useRef(initialOrders);
  const known = useRef(new Map(initialOrders.map((o) => [o.id, o.status])));

  // Re-read our own API every 5 s (SQLite only). New orders and orders that just got paid slide in.
  const applyOrders = useCallback(
    (polled: Order[]) => {
      const next = mergePolledOrders(ordersRef.current, polled);
      const arrived: string[] = [];
      for (const o of next) {
        const before = known.current.get(o.id);
        if (before === undefined || (before !== 'paid' && o.status === 'paid')) arrived.push(o.id);
        if (before !== 'paid' && o.status === 'paid') {
          toast({ title: `Payment received · ${o.number}`, description: `${formatUSD(o.totalCents)} · ${whereLabel(o)}`, tone: 'ok' });
        }
      }
      known.current = new Map(next.map((o) => [o.id, o.status]));
      ordersRef.current = next;
      setOrders(next);
      if (arrived.length) {
        setFresh(new Set(arrived));
        setTimeout(() => setFresh(new Set()), 1500);
      }
    },
    [toast],
  );

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
    known.current.set(updated.id, updated.status);
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
      toast({ title: paused ? 'Agent orders paused' : 'Taking agent orders again', tone: 'ok', durationMs: 3000 });
    } catch (e) {
      setStatus(before);
      setPauseError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setPausing(false);
    }
  };

  const toPrepare = orders.filter((o) => o.status === 'paid').length;
  const paused = status === 'paused';

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-gutter pt-6 pb-section lg:pt-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="type-title">{shop.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ShopStatusBadge status={status} />
            {status !== 'draft' ? (
              <Link
                href={`/s/${shop.slug}`}
                className="inline-flex min-h-tap items-center gap-1.5 font-semibold text-accent-ink underline underline-offset-4 hover:text-accent-active"
              >
                View your shop <Icon icon={ExternalLink} size="sm" />
              </Link>
            ) : (
              <Link
                href={`/shops/${shop.id}/setup`}
                className="inline-flex min-h-tap items-center font-semibold text-accent-ink underline underline-offset-4"
              >
                Finish setting up
              </Link>
            )}
          </div>
        </div>
        {status !== 'draft' && (
          <Card tone="flat" padding="none" className="px-4 py-2 lg:w-104">
            <Switch
              label="Pause agent orders"
              description={
                paused
                  ? "Assistants can still read your menu but can’t order. Paid orders aren’t affected."
                  : 'Stops new orders from AI assistants, for example when you are sold out for the day.'
              }
              checked={paused}
              busy={pausing}
              onChange={togglePause}
            />
            {pauseError && <FieldError className="pb-2">{pauseError}</FieldError>}
          </Card>
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
                paypalReachable={paypalReachable}
                onOrderChange={onOrderChange}
                onShowShare={() => selectTab('share')}
              />
            ),
          },
          {
            id: 'menu',
            label: 'Menu',
            content: <MenuPanel items={items} shopId={shop.id} slug={shop.slug} onItemsChange={setItems} />,
          },
          {
            id: 'share',
            label: 'Share',
            content: <SharePanel shopUrl={`${appUrl}/s/${shop.slug}`} doorUrl={`${appUrl}/s/${shop.slug}/mcp`} slug={shop.slug} />,
          },
        ]}
      />
    </div>
  );
}
