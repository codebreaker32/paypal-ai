'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import { AuthProblemText, FormProblem } from '@/components/auth/AuthProblemText';
import { PasswordField } from '@/components/auth/fields';
import { useAuthForm } from '@/components/auth/use-auth-form';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { changePassword, deleteAccount, logOutOtherDevices } from '@/lib/client/auth';
import { changePasswordProblem, checkChangePassword, checkCurrentPassword, currentPasswordProblem, passwordHint } from '@/lib/client/auth-copy';
import { useAction } from '@/lib/feedback/use-action';

/** One titled block of `/account`, ruled off from the one above it. */
function AccountSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-6 border-t border-line py-6">
      <h2 id={headingId} className="type-section">
        {title}
      </h2>
      {children}
    </section>
  );
}

const PASSWORD_IDS = { password: 'change-current-password', newPassword: 'change-new-password' };

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changed, setChanged] = useState(false);
  const { problem, busy, ready, submit, finish, clearProblem } = useAuthForm(PASSWORD_IDS);

  const edited = () => {
    clearProblem();
    setChanged(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkChangePassword(current, next),
      async () => {
        await changePassword(current, next);
        setCurrent('');
        setNext('');
        setChanged(true);
        finish();
      },
      changePasswordProblem,
    );
  };

  return (
    <AccountSection id="password" title="Password">
      <form method="post" onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <PasswordField
          id={PASSWORD_IDS.password}
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(v) => {
            setCurrent(v);
            edited();
          }}
          error={problem?.field === 'password' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <PasswordField
          id={PASSWORD_IDS.newPassword}
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(v) => {
            setNext(v);
            edited();
          }}
          hint={passwordHint(next)}
          liveHint
          error={problem?.field === 'newPassword' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <FormProblem problem={problem} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" variant="secondary" disabled={!ready} loading={busy} loadingLabel="Changing…" className="self-start">
            Change password
          </Button>
          <p role="status" className="flex min-w-0 items-start gap-1.5 font-medium text-ok">
            {changed && (
              <>
                <Icon icon={CircleCheck} size="sm" className="mt-1" />
                <span>Password changed. Your other devices are logged out.</span>
              </>
            )}
          </p>
        </div>
      </form>
    </AccountSection>
  );
}

function OtherDevices() {
  const { status, run, error } = useAction(logOutOtherDevices);
  return (
    <AccountSection id="devices" title="Other devices">
      <p className="mt-1 text-ink-soft">Lost a phone or used a shared computer? This device stays logged in.</p>
      <Button
        variant="secondary"
        status={status}
        loadingLabel="Logging out…"
        successLabel="Logged out"
        className="mt-4"
        onClick={() => void run()}
      >
        Log out of other devices
      </Button>
      {error && <FieldError className="mt-3">{error}</FieldError>}
    </AccountSection>
  );
}

const DELETE_IDS = { password: 'delete-account-password' };

function DeleteAccount() {
  const [password, setPassword] = useState('');
  const { problem, busy, ready, submit, clearProblem } = useAuthForm(DELETE_IDS);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkCurrentPassword(password),
      async () => {
        await deleteAccount(password);
        window.location.replace('/');
      },
      currentPasswordProblem,
    );
  };

  return (
    <AccountSection id="delete-account" title="Delete account">
      <p className="mt-1 text-ink-soft">Your account and every shop in it are deleted from Shelfie. Buyers keep their PayPal receipts. This can’t be undone.</p>
      <form method="post" onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <PasswordField
          id={DELETE_IDS.password}
          label="Your password"
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearProblem();
          }}
          error={problem?.field === 'password' ? <AuthProblemText problem={problem} /> : undefined}
        />
        <FormProblem problem={problem} />
        <Button
          type="submit"
          variant="ghost"
          disabled={!ready}
          loading={busy}
          loadingLabel="Deleting…"
          className="-ml-(--button-px-md) self-start text-error hover:bg-error-soft active:bg-error-soft"
        >
          Delete account
        </Button>
      </form>
    </AccountSection>
  );
}

/** Password, other devices and deleting the account, below the recovery key on `/account`. */
export function AccountActions() {
  return (
    <>
      <ChangePassword />
      <OtherDevices />
      <DeleteAccount />
    </>
  );
}
