'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { signup, type KeyAndNext } from '@/lib/client/auth';
import { checkSignup, passwordHint, signupProblem } from '@/lib/client/auth-copy';
import { AuthHeading } from './AuthHeading';
import { AuthProblemText, FormProblem } from './AuthProblemText';
import { EmailField, PasswordField } from './fields';
import { RecoveryKeyStep } from './RecoveryKeyStep';
import { announceSession } from '@/lib/client/started-session';
import { useAuthForm } from './use-auth-form';

const IDS = { email: 'signup-email', password: 'new-password' };
const INLINE_LINK = 'press-text font-semibold underline underline-offset-2';

export function SignupForm({ appUrl }: { appUrl: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState<KeyAndNext | null>(null);
  const { problem, busy, ready, submit, clearProblem } = useAuthForm(IDS);

  if (done) return <RecoveryKeyStep recoveryKey={done.recoveryKey} email={email.trim().toLowerCase()} next={done.next} appUrl={appUrl} />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkSignup(email, password),
      async () => {
        const created = await signup(email, password);
        announceSession(email.trim().toLowerCase());
        setDone(created);
      },
      signupProblem,
    );
  };

  return (
    <>
      <AuthHeading title="Create your account" />
      <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <EmailField
          id={IDS.email}
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearProblem();
          }}
          error={problem?.field === 'email' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <PasswordField
          id={IDS.password}
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearProblem();
          }}
          hint={passwordHint(password)}
          liveHint
          error={problem?.field === 'password' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <FormProblem problem={problem} />
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!ready} loading={busy} loadingLabel="Creating your account...">
          Create account
        </Button>
        <p className="type-meta text-ink-muted">
          By creating an account you agree to the{' '}
          <Link href="/terms" className={INLINE_LINK}>
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className={INLINE_LINK}>
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </>
  );
}
