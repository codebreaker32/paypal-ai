'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { login } from '@/lib/client/auth';
import { checkLogin, loginProblem } from '@/lib/client/auth-copy';
import { AuthHeading } from './AuthHeading';
import { AuthProblemText, FormProblem } from './AuthProblemText';
import { EmailField, PasswordField } from './fields';
import { useAuthForm } from './use-auth-form';

const IDS = { email: 'login-email', password: 'current-password' };

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { problem, busy, submit, clearProblem } = useAuthForm(IDS);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkLogin(email, password),
      async () => {
        const { next: to } = await login(email, password, next ?? undefined);
        // A full replace, so the login page leaves this tab's history and every page reads the new session (SR21).
        window.location.replace(to);
      },
      loginProblem,
    );
  };

  return (
    <>
      <AuthHeading title="Log in">{next?.startsWith('/shops/') ? 'Log in to open this shop.' : null}</AuthHeading>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <EmailField
          id={IDS.email}
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearProblem();
          }}
          error={problem?.field === 'email' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <div className="flex flex-col">
          <PasswordField
            id={IDS.password}
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearProblem();
            }}
            error={problem?.field === 'password' ? <AuthProblemText problem={problem} /> : undefined}
          />
          <TextLink href="/recover" className="self-end text-sm">
            Forgot password?
          </TextLink>
        </div>
        <FormProblem problem={problem} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} loadingLabel="Logging in...">
          Log in
        </Button>
      </form>
    </>
  );
}
