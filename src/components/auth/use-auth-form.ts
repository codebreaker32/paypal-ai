'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import type { AuthProblem, ProblemField } from '@/lib/client/auth-copy';

const never = () => () => undefined;

/** What every account form shares: one problem at a time, one request at a time, and focus on the field to fix. */
export function useAuthForm(fieldIds: Partial<Record<ProblemField, string>>) {
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Before React arrives a submit would be a plain POST that comes back as a blank form, so the button waits for it.
  const ready = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );

  const fail = (next: AuthProblem) => {
    inFlight.current = false;
    setBusy(false);
    setProblem(next);
    const id = fieldIds[next.field];
    if (id) document.getElementById(id)?.focus();
  };

  /** Runs the request once, however many times the form is submitted. A problem from `check` sends nothing. */
  const submit = async (check: AuthProblem | null, request: () => Promise<void>, toProblem: (err: unknown) => AuthProblem) => {
    if (inFlight.current) return;
    if (check) {
      fail(check);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await request();
    } catch (err) {
      fail(toProblem(err));
    }
  };

  return { problem, busy, ready, submit, clearProblem: () => setProblem(null) };
}
