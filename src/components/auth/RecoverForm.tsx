'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { TextLink } from '@/components/ui/text-link';
import { recover, type KeyAndNext } from '@/lib/client/auth';
import { checkRecover, passwordHint, recoverProblem } from '@/lib/client/auth-copy';
import { AuthHeading } from './AuthHeading';
import { AuthSwitch } from './AuthSwitch';
import { AuthProblemText, FormProblem } from './AuthProblemText';
import { EmailField, PasswordField, useKeepTypedValue } from './fields';
import { RecoveryKeyStep } from './RecoveryKeyStep';
import { announceSession } from '@/lib/client/started-session';
import { useAuthForm } from './use-auth-form';

const IDS = { email: 'recover-email', recoveryKey: 'recovery-key', password: 'recover-new-password' };

export function RecoverForm({ appUrl }: { appUrl: string }) {
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState<KeyAndNext | null>(null);
  const { problem, busy, ready, submit, clearProblem } = useAuthForm(IDS);
  const keyInput = useKeepTypedValue(recoveryKey, setRecoveryKey);

  if (done) return <RecoveryKeyStep recoveryKey={done.recoveryKey} email={email.trim().toLowerCase()} next={done.next} appUrl={appUrl} />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkRecover(email, recoveryKey, password),
      async () => {
        const created = await recover(email, recoveryKey, password);
        announceSession(email.trim().toLowerCase());
        setDone(created);
      },
      recoverProblem,
    );
  };

  return (
    <>
      <AuthHeading title="Reset your password">Use the recovery key you saved when you signed up.</AuthHeading>
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
        <Field
          label="Recovery key"
          id={IDS.recoveryKey}
          error={problem?.field === 'recoveryKey' ? <AuthProblemText problem={problem} /> : undefined}
        >
          {(control) => (
            <Input
              {...control}
              ref={keyInput}
              name={IDS.recoveryKey}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              value={recoveryKey}
              onChange={(e) => {
                setRecoveryKey(e.target.value);
                clearProblem();
              }}
            />
          )}
        </Field>
        <PasswordField
          id={IDS.password}
          label="New password"
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
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!ready} loading={busy} loadingLabel="Saving...">
          Set new password
        </Button>
        <AuthSwitch prompt="Remembered it?" label="Log in" href="/login" />
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Lost your key too? <TextLink href="/help#locked-out">What you can do</TextLink>
      </p>
    </>
  );
}
