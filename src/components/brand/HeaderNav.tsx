'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { footerKind } from '@/lib/brand/footer';
import { headerView } from '@/lib/brand/header';
import { startedAccount, subscribeStartedSession } from '@/lib/client/started-session';
import { AccountMenu } from './AccountMenu';
import { BandHeader } from './BandHeader';
import { Frame } from './Frame';
import { Logo } from './Logo';

/** The header, which depends on the page (`lib/brand/header.ts` holds the table). Home, help and legal get the sticky band. */
export function HeaderNav({ account, ownerShopIds }: { account: { email: string } | null; ownerShopIds: string[] }) {
  const started = useSyncExternalStore(subscribeStartedSession, startedAccount, () => null);
  const pathname = usePathname() ?? '/';
  const view = headerView({ pathname, account: account ?? started, ownerShopIds });
  if (footerKind(pathname) === 'site' && (view.kind === 'public' || view.kind === 'account')) return <BandHeader view={view} />;
  return (
    <header data-site-chrome="" className="border-b border-line bg-surface">
      <Frame className="flex h-16 items-center justify-between gap-3">
      <Link href={view.logoHref} aria-label="Shelfie home" className="press-text -mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
        <Logo />
      </Link>
      {view.kind === 'account' && <AccountMenu email={view.email} placement="down" className="-mr-2.5" />}
      {view.kind === 'public' && (
        <div className="flex items-center gap-1 sm:gap-2">
          {view.dashboardHref && (
            <Link href={view.dashboardHref} className="press-text inline-flex min-h-tap items-center px-2 font-semibold">
              Dashboard
            </Link>
          )}
          <ButtonLink href="/login" variant="ghost">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary" className="hidden sm:inline-flex">
            Add your shop
          </ButtonLink>
        </div>
      )}
      </Frame>
    </header>
  );
}
