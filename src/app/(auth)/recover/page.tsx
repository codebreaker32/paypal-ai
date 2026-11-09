import type { Metadata } from 'next';
import { RecoverForm } from '@/components/auth/RecoverForm';
import { getConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Reset your password · Shelfie', robots: { index: false } };

export default function RecoverPage() {
  return <RecoverForm appUrl={getConfig().appUrl} />;
}
