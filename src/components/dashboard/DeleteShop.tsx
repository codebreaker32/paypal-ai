'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { AuthProblemText, FormProblem } from '@/components/auth/AuthProblemText';
import { PasswordField } from '@/components/auth/fields';
import { useAuthForm } from '@/components/auth/use-auth-form';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { deleteShop } from '@/lib/client/auth';
import { checkDeleteShop, deleteShopProblem } from '@/lib/client/auth-copy';

const IDS = { name: 'delete-shop-name', password: 'delete-shop-password' };

/** The foot of Settings: what deleting does, and the sheet that asks for the shop's name and the password. */
export function DeleteShop({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');
  const { problem, busy, ready, submit, clearProblem } = useAuthForm(IDS);
  const nameInput = useRef<HTMLInputElement>(null);
  const formId = useId();

  // Nothing typed here should still be there the next time it opens, and a delete in flight can't be walked away from.
  const close = () => {
    if (busy) return;
    setOpen(false);
    setTypedName('');
    setPassword('');
    clearProblem();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(
      checkDeleteShop(typedName, shopName, password),
      async () => {
        await deleteShop(shopId, typedName, password);
        window.location.replace('/shops');
      },
      deleteShopProblem,
    );
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-ink-soft">
        Your shop page and agent door stop working, and its menu, photos and orders are deleted from Shelfie. Buyers keep their PayPal receipts. This can’t be undone.
      </p>
      <Button variant="ghost" className="-ml-(--button-px-md) text-error hover:bg-error-soft active:bg-error-soft" onClick={() => setOpen(true)}>
        Delete shop
      </Button>
      <Sheet
        open={open}
        onClose={close}
        title={`Delete ${shopName}?`}
        initialFocusRef={nameInput}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" aria-disabled={busy || undefined} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="danger" disabled={!ready} loading={busy} loadingLabel="Deleting…">
              Delete shop
            </Button>
          </div>
        }
      >
        <form id={formId} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Type the shop’s name to confirm" id={IDS.name} error={problem?.field === 'name' ? <AuthProblemText problem={problem} /> : undefined}>
            {(c) => (
              <TextInput
                {...c}
                ref={nameInput}
                name={IDS.name}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={typedName}
                onChange={(e) => {
                  setTypedName(e.currentTarget.value);
                  clearProblem();
                }}
              />
            )}
          </Field>
          <PasswordField
            id={IDS.password}
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
        </form>
      </Sheet>
    </div>
  );
}
