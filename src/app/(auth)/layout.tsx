import type { ReactNode } from 'react';
import { AuthFrame } from '@/components/auth/AuthFrame';

/** Sign-up, login and recovery: the form on a white card over blush, beside the photo panel from lg (AuthFrame). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
