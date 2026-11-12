'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** The "Log in with PayPal" block atop /orders: a way in when signed out, who and "Log out" when signed in. */
export function PayPalLoginBlock({ signedInAs, message }: { signedInAs: string | null; message: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await fetch('/api/buyer/logout', { method: 'POST' });
    } catch {
      // Offline: the page reloads as it is.
    }
    router.replace('/orders');
    router.refresh();
    setBusy(false);
  };

  return (
    <section aria-label="Log in with PayPal" className="mt-6 flex flex-col gap-3 rounded-lg border border-line p-4">
      {message && (
        <p role="alert" className="type-body font-semibold text-error">
          {message}
        </p>
      )}
      {signedInAs ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body text-ink-soft">
            Signed in with PayPal as <span className="font-semibold text-ink">{signedInAs}</span>
          </p>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="press-text min-h-tap rounded-sm font-semibold text-ink underline underline-offset-4 disabled:opacity-60"
          >
            Log out
          </button>
        </div>
      ) : (
        <>
          <p className="type-heading">See your orders on any device</p>
          <a
            href="/api/buyer/paypal/start"
            className="press inline-flex min-h-tap items-center justify-center self-start rounded-full bg-[#0070ba] px-6 font-semibold text-white hover:bg-[#005ea6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070ba]"
          >
            Log in with PayPal
          </a>
          <p className="type-meta text-ink-muted">We only read your PayPal email to find orders you paid for.</p>
        </>
      )}
    </section>
  );
}
