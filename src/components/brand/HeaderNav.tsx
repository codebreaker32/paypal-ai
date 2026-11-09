'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { headerView } from '@/lib/brand/header';
import { startedAccount, subscribeStartedSession } from '@/lib/client/started-session';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';

/** The header's contents, which depend on the page (`lib/brand/header.ts` holds the table). */
export function HeaderNav({ account, ownerShopIds }: { account: { email: string } | null; ownerShopIds: string[] }) {
  const started = useSyncExternalStore(subscribeStartedSession, startedAccount, () => null);
  const view = headerView({ pathname: usePathname() ?? '/', account: account ?? started, ownerShopIds });
  return (
    <>
      <Link href={view.logoHref} aria-label="Shelfie home" className="press-text -mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
        <Logo />
      </Link>
      {view.kind === 'account' && <AccountMenu email={view.email} placement="down" className="-mr-2.5" />}
      {view.kind === 'auth' && (
        <p className="text-sm">
          <span className="hidden text-ink-soft sm:inline">{view.prompt} </span>
          <TextLink href={view.href}>{view.label}</TextLink>
        </p>
      )}
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
    </>
  );
}
