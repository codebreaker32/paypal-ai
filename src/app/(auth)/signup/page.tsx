import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/auth/SignupForm';
import { currentAccount, landingPath } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Create your account · Shelfie' };

export default async function SignupPage() {
  const account = await currentAccount();
  if (account) redirect(landingPath(account.id));
  return <SignupForm appUrl={getConfig().appUrl} />;
}
