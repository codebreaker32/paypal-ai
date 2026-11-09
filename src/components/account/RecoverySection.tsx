'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { AuthProblemText, FormProblem } from '@/components/auth/AuthProblemText';
import { PasswordField } from '@/components/auth/fields';
import { RecoveryKeyStep } from '@/components/auth/RecoveryKeyStep';
import { useAuthForm } from '@/components/auth/use-auth-form';
import { LocalDay } from '@/components/dashboard/LocalTime';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { createRecoveryKey } from '@/lib/client/auth';
import { checkCurrentPassword, currentPasswordProblem } from '@/lib/client/auth-copy';

const IDS = { password: 'account-current-password' };

export interface RecoverySectionProps {
  email: string;
  /** When the key was last saved, or null. */
  savedAt: string | null;
  appUrl: string;
  /** The rest of the account page, above this section: it gives way to the key step, which has the page's only H1. */
  children: ReactNode;
}

/** The recovery key's state and a new key, on `/account`. A new key is shown once, in place of the page. */
export function RecoverySection({ email, savedAt, appUrl, children }: RecoverySectionProps) {
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const { problem, busy, submit, clearProblem } = useAuthForm(IDS);

  if (recoveryKey) return <RecoveryKeyStep recoveryKey={recoveryKey} email={email} next="/account" appUrl={appUrl} />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkCurrentPassword(password),
      async () => {
        const created = await createRecoveryKey(password);
        setRecoveryKey(created.recoveryKey);
      },
      currentPasswordProblem,
    );
  };

  return (
    <>
      {children}
      <section id="recovery-key" aria-labelledby="recovery-key-title" className="scroll-mt-6 border-t border-line py-6">
        <h2 id="recovery-key-title" className="type-section">
          Recovery key
        </h2>
        {savedAt ? (
          <p className="mt-1 flex items-center gap-1.5 font-medium text-ok">
            <Icon icon={CircleCheck} size="sm" />
            <span>
              Saved on <LocalDay iso={savedAt} />
            </span>
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 font-medium text-warn">
            <Icon icon={TriangleAlert} size="sm" />
            <span>Not saved yet</span>
          </p>
        )}
        <form method="post" onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
          <PasswordField
            id={IDS.password}
            label="Current password"
            autoComplete="current-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearProblem();
            }}
            hint="This cancels your old key."
            error={problem?.field === 'password' ? <AuthProblemText problem={problem} /> : undefined}
          />
          <FormProblem problem={problem} />
          <Button type="submit" variant="secondary" loading={busy} loadingLabel="Creating…" className="self-start">
            Create a new key
          </Button>
        </form>
      </section>
    </>
  );
}
