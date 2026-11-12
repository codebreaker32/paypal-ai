import type { Metadata } from 'next';
import { MyOrdersList } from '@/components/orders/MyOrdersList';
import { PayPalLoginBlock } from '@/components/orders/PayPalLoginBlock';
import { paypalLoginEnabled } from '@/lib/buyer/paypal-login';
import { currentBuyerEmails } from '@/lib/buyer/session';
import { maskEmail } from '@/lib/domain/payee';

export const metadata: Metadata = {
  title: 'Your orders · Shelfie',
  robots: { index: false },
};

const PAYPAL_MESSAGES: Record<string, string> = {
  error: 'We couldn’t log you in with PayPal. Please try again.',
  noemail: 'Your PayPal account didn’t share a confirmed email, so we couldn’t find your orders.',
};

/**
 * "Your orders": the receipts this browser has opened (localStorage), plus, with "Log in with PayPal" on
 * (PAYPAL_LOGIN_ENABLED=1), every order paid with the buyer's PayPal account.
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const enabled = paypalLoginEnabled();
  const emails = enabled ? await currentBuyerEmails() : null;
  const paypal = (await searchParams).paypal;
  const message = enabled && typeof paypal === 'string' ? (PAYPAL_MESSAGES[paypal] ?? null) : null;
  const signedInAs = emails ? maskEmail(emails[0]) : null;
  return (
    <div className="mx-auto w-full max-w-measure px-gutter pt-8 pb-section lg:pt-16">
      <h1 className="type-display">Your orders</h1>
      {enabled && <PayPalLoginBlock signedInAs={signedInAs} message={message} />}
      {/* Keyed so a logout (a refresh with no session) drops the PayPal rows. */}
      <MyOrdersList key={signedInAs ? 'paypal' : 'device'} withPayPal={signedInAs !== null} />
    </div>
  );
}
