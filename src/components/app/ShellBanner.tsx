'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleAlert, CirclePause, CloudOff, KeyRound, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { setShopStatus } from '@/components/dashboard/api';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { pickBanner, sectionHref } from '@/lib/seller/shell-view';
import { SectionLink } from './SectionLink';
import { patchShell, type ShellValues } from './shell-store';

const ACTION = 'press-text inline-flex min-h-tap items-center font-semibold whitespace-nowrap text-warn underline decoration-2 underline-offset-4';

function Banner({ icon, action, children }: { icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-(--card-radius) bg-warn-soft px-4 py-3 text-warn print:hidden">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <Icon icon={icon} className="mt-0.5" />
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}

function ResumeButton({ shopId }: { shopId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resume = async () => {
    setBusy(true);
    patchShell(shopId, { status: 'live' });
    try {
      await setShopStatus(shopId, 'live');
    } catch (e) {
      patchShell(shopId, { status: 'paused' });
      toast({ title: e instanceof Error ? e.message : 'Couldn’t save. Try again.', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={ACTION} aria-disabled={busy} onClick={busy ? undefined : () => void resume()}>
      Resume
    </button>
  );
}

/** One slot, one banner, in the priority `pickBanner` decides. */
export function ShellBanner({ shopId, values }: { shopId: string; values: ShellValues }) {
  switch (pickBanner(values)) {
    case 'paypal-down':
      return (
        <Banner icon={CloudOff}>
          <span className="font-semibold">We can’t reach PayPal right now.</span> Payments will show up here as soon as it answers.
        </Banner>
      );
    case 'payee-missing':
      return (
        <Banner
          icon={CircleAlert}
          action={
            <SectionLink href={sectionHref(shopId, 'settings')} shopId={shopId} pressAs="press-text" className={ACTION}>
              Add email
            </SectionLink>
          }
        >
          <span className="font-semibold">Not taking orders: add your PayPal email.</span>
        </Banner>
      );
    case 'paused':
      return (
        <Banner icon={CirclePause} action={<ResumeButton shopId={shopId} />}>
          <span className="font-semibold">Agent orders paused.</span> Assistants can still read your menu.
        </Banner>
      );
    case 'recovery-key':
      return (
        <Banner
          icon={KeyRound}
          action={
            <Link href="/account#recovery-key" className={ACTION}>
              Get a new key
            </Link>
          }
        >
          <span className="font-semibold">Save your recovery key.</span> Without it we can’t get you back into your account.
        </Banner>
      );
    default:
      return null;
  }
}
