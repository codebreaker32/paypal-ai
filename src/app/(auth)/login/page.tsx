import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { googleErrorMessage } from '@/components/auth/GoogleSignIn';
import { LoginForm } from '@/components/auth/LoginForm';
import { googleEnabled } from '@/lib/auth/google';
import { safeNext } from '@/lib/auth/next-path';
import { currentAccount, landingPath } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Log in · Shelfie' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const account = await currentAccount();
  if (account) redirect(next ?? landingPath(account.id));
  return <LoginForm next={next} google={googleEnabled()} notice={googleErrorMessage(params.error)} />;
}
