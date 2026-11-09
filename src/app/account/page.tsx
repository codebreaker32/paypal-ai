import type { Metadata } from 'next';
import { RecoverySection } from '@/components/account/RecoverySection';
import { PageHeader } from '@/components/app/PageHeader';
import { requireAccount } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Account · Shelfie', robots: { index: false } };

export default async function AccountPage() {
  const account = await requireAccount('/account');
  return (
    <div className="mx-auto w-full max-w-page px-gutter pt-6 pb-12 lg:pt-10">
      <div className="max-w-measure">
        <RecoverySection email={account.email} savedAt={account.recoverySavedAt} appUrl={getConfig().appUrl}>
          <PageHeader title="Account" />
          <section aria-labelledby="login-email-title" className="flex flex-col gap-1 pb-6">
            <h2 id="login-email-title" className="type-section">
              Login email
            </h2>
            <p className="[overflow-wrap:anywhere]">{account.email}</p>
          </section>
        </RecoverySection>
      </div>
    </div>
  );
}
