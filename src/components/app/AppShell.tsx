'use client';

import Link from 'next/link';
import { useLayoutEffect, type ReactNode } from 'react';
import { ChevronsUpDown, CircleUserRound, ExternalLink } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { Icon } from '@/components/ui/icon';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import type { ShopStatus } from '@/lib/domain/types';
import type { ShellAccount, ShellData } from '@/lib/seller/shell';
import { shopStatusWord } from '@/lib/seller/shell-view';
import { AppNav } from './AppNav';
import { ShellBanner } from './ShellBanner';
import { seedShell, useShellValues, type ShellValues } from './shell-store';

const STATUS_TONE = { ok: 'text-ok', warn: 'text-warn', neutral: 'text-ink-muted' } as const;

function ShopSwitcher({ data, values, account }: { data: ShellData; values: ShellValues; account: ShellAccount | null }) {
  const { tone, word } = shopStatusWord(values.status, values.payeeMissing);
  const body = (
    <>
      <ShopAvatar shop={{ logoUrl: values.logoUrl, coverUrl: values.coverUrl, kind: data.avatar.kind, menuPhotoSrc: data.avatar.menuPhotoSrc }} items={data.avatar.items} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span title={data.name} className="line-clamp-2 text-sm font-bold [overflow-wrap:anywhere]">
          {data.name}
        </span>
        <span className={`inline-flex items-center gap-1.5 type-meta font-semibold ${STATUS_TONE[tone]}`}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {word}
        </span>
      </span>
    </>
  );
  const box = 'flex w-full items-center gap-2.5 rounded-md p-2';
  if (!account) {
    return (
      <div data-testid="shop-switcher" className={box}>
        {body}
      </div>
    );
  }
  return (
    <Link href="/shops" data-testid="shop-switcher" aria-label={`${data.name}, switch shop`} className={`press ${box} hover:bg-surface-sunken`}>
      {body}
      <Icon icon={ChevronsUpDown} size="sm" className="text-ink-muted" />
    </Link>
  );
}

function ViewShopLink({ data, status }: { data: ShellData; status: ShopStatus }) {
  const row = 'press flex min-h-tap items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink';
  if (status === 'draft') {
    return (
      <Link href={`/shops/${data.shopId}/setup`} className={row}>
        Finish setting up
      </Link>
    );
  }
  return (
    <Link href={`/s/${data.slug}`} className={row}>
      <Icon icon={ExternalLink} />
      View your shop
    </Link>
  );
}

function AccountSlot({ account }: { account: ShellAccount | null }) {
  const row = 'press-text flex min-h-tap items-center gap-3 rounded-md px-3 text-sm font-semibold';
  if (!account) {
    return (
      <Link href="/login" className={row}>
        <Icon icon={CircleUserRound} />
        Log in
      </Link>
    );
  }
  return (
    <Link href="/account" className={row}>
      <Icon icon={CircleUserRound} />
      <span className="min-w-0 truncate">{account.email}</span>
    </Link>
  );
}

/** The seller's product chrome around every /shops/[id] screen: a sidebar on desktop, top and tab bars on phones. */
export function AppShell({ data, account, children }: { data: ShellData; account: ShellAccount | null; children: ReactNode }) {
  const values = useShellValues(data.shopId, data.values);

  // Before the dashboard's effects run, so its first patch lands on this shop.
  useLayoutEffect(() => {
    seedShell(data.shopId, data.values, data.readAt);
  }, [data.shopId, data.values, data.readAt]);

  const home = account ? '/shops' : '/';

  return (
    <div data-app-shell="" className="flex flex-1 flex-col print:block">
      <a
        href="#app-content"
        className="press-text fixed top-4 left-4 z-(--z-toast) inline-flex min-h-tap -translate-y-[calc(100%+2rem)] items-center rounded-md bg-ink px-4 font-semibold text-surface focus:translate-y-0 print:hidden"
      >
        Skip to content
      </a>

      <div className="flex-1 lg:grid lg:grid-cols-[var(--app-sidebar-w)_minmax(0,1fr)] print:block">
        <div className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-3 lg:flex print:hidden">
          <Link href={home} aria-label="Shelfie home" className="press-text mb-1 flex min-h-tap items-center self-start rounded-sm px-2">
            <Logo size="sm" />
          </Link>
          <div className="mb-2">
            <ShopSwitcher data={data} values={values} account={account} />
          </div>
          <AppNav shopId={data.shopId} toPrepare={values.toPrepare} variant="sidebar" />
          <div className="mx-3 my-2 h-px bg-line" aria-hidden="true" />
          <ViewShopLink data={data} status={values.status} />
          <div className="flex-1" />
          <p className="px-3 pb-2 type-meta text-ink-muted">{TEST_MODE_LINE}</p>
          <AccountSlot account={account} />
        </div>

        <div className="sticky top-0 z-(--z-header) flex h-(--app-topbar-h) items-center gap-2 border-b border-line bg-surface px-gutter lg:hidden print:hidden">
          <Link href={home} aria-label="Shelfie home" className="press-icon -ml-2.5 flex size-tap shrink-0 items-center justify-center rounded-md">
            <LogoMark className="size-6" />
          </Link>
          {account ? (
            <Link href="/shops" data-testid="shop-switcher-bar" aria-label={`${data.name}, switch shop`} title={data.name} className="press-text flex min-h-tap min-w-0 flex-1 items-center text-sm font-bold">
              <span className="truncate">{data.name}</span>
            </Link>
          ) : (
            <p data-testid="shop-switcher-bar" title={data.name} className="min-w-0 flex-1 truncate text-sm font-bold">
              {data.name}
            </p>
          )}
          <Link href={account ? '/account' : '/login'} aria-label={account ? 'Account' : 'Log in'} className="press-icon -mr-2.5 flex size-tap shrink-0 items-center justify-center rounded-md hover:bg-surface-sunken">
            <Icon icon={CircleUserRound} size="lg" />
          </Link>
        </div>

        <div
          id="app-content"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-page px-gutter pt-4 pb-[calc(var(--app-tabbar-h)+env(safe-area-inset-bottom)+1.5rem)] outline-none lg:pt-8 lg:pb-12 print:max-w-none print:p-0"
        >
          <ShellBanner shopId={data.shopId} values={values} />
          {children}
          <p className="mt-8 type-meta text-ink-muted lg:hidden print:hidden">{TEST_MODE_LINE}</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-(--z-header) h-[calc(var(--app-tabbar-h)+env(safe-area-inset-bottom))] border-t border-line bg-surface lg:hidden print:hidden">
        <AppNav shopId={data.shopId} toPrepare={values.toPrepare} variant="bar" />
      </div>
    </div>
  );
}
