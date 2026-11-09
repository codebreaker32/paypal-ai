import { redirect, unstable_rethrow } from 'next/navigation';
import { LIVE_SHOP_HREF } from '@/app/_start/samples';
import { Closing } from '@/components/landing/Closing';
import { Faq } from '@/components/landing/Faq';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { currentAccount, landingPath } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { RESERVED_SLUG } from '@/lib/domain/payee';

/** Where a logged-in visitor goes instead, or null to show the page. The landing page must render even if storage is down. */
function destinationFor(accountId: string): string | null {
  try {
    return landingPath(accountId);
  } catch (err) {
    console.error('Landing page: could not read the account’s shops', err instanceof Error ? err.message : err);
    return null;
  }
}

async function readAccountId(): Promise<string | null> {
  try {
    return (await currentAccount())?.id ?? null;
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    console.error('Landing page: could not read the session', err instanceof Error ? err.message : err);
    return null;
  }
}

/** The example shop's address while it is live; no link at all on a deployment that hasn't seeded it. */
function exampleShopHref(): string | null {
  try {
    return shops.bySlug(getDb(), RESERVED_SLUG)?.status === 'live' ? LIVE_SHOP_HREF : null;
  } catch (err) {
    console.error('Landing page: could not read the example shop', err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function LandingPage() {
  const accountId = await readAccountId();
  const destination = accountId && destinationFor(accountId);
  if (destination) redirect(destination);

  return (
    <>
      <Hero />
      <HowItWorks exampleShopHref={exampleShopHref()} />
      <Faq />
      <Closing />
    </>
  );
}
