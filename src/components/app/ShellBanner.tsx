'use client';

import { useState } from 'react';
import { CircleAlert, CirclePause, CloudOff } from 'lucide-react';
import { setShopStatus } from '@/components/dashboard/api';
import { useToast } from '@/components/ui/toast';
import { pickBanner, sectionHref } from '@/lib/seller/shell-view';
import { Banner, BANNER_ACTION as ACTION } from './Banner';
import { RecoveryBanner } from '@/components/shops/RecoveryBanner';
import { SectionLink } from './SectionLink';
import { patchShell, type ShellValues } from './shell-store';

function ResumeButton({ shopId, onResumed }: { shopId: string; onResumed: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resume = async () => {
    setBusy(true);
    // This button goes with the banner: focus moves on first (as switching section does), and the page says it worked.
    document.querySelector<HTMLElement>('#app-content h1')?.focus({ preventScroll: true });
    onResumed();
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
    <button type="button" className={`press-text ${ACTION}`} aria-disabled={busy} onClick={busy ? undefined : () => void resume()}>
      Resume
    </button>
  );
}

/** One slot, one banner, in the priority `pickBanner` decides. */
export function ShellBanner({ shopId, values }: { shopId: string; values: ShellValues }) {
  const [said, setSaid] = useState('');
  const kind = pickBanner(values);
  return (
    <>
      {/* Always in the page, so a screen reader hears it after the banner that held the button has gone. */}
      <p role="status" className="sr-only">
        {kind ? '' : said}
      </p>
      <BannerFor kind={kind} shopId={shopId} onResumed={() => setSaid('Agent orders are on again.')} />
    </>
  );
}

function BannerFor({ kind, shopId, onResumed }: { kind: ReturnType<typeof pickBanner>; shopId: string; onResumed: () => void }) {
  switch (kind) {
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
        <Banner icon={CirclePause} action={<ResumeButton shopId={shopId} onResumed={onResumed} />}>
          <span className="font-semibold">Agent orders paused.</span> Assistants can still read your menu.
        </Banner>
      );
    case 'recovery-key':
      return <RecoveryBanner />;
    default:
      return null;
  }
}
