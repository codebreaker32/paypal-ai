// A session started in this tab without a page load (sign-up and recovery stay on their page for the recovery key step).
// The server-rendered header can't know, and refreshing /signup would redirect away from a key shown only once, so the
// header reads the account from here until the next full page load.

export interface StartedAccount {
  email: string;
}

let account: StartedAccount | null = null;
const listeners = new Set<() => void>();

export function startedAccount(): StartedAccount | null {
  return account;
}

export function subscribeStartedSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceSession(email: string): void {
  account = { email };
  listeners.forEach((l) => l());
}

/** For tests: forgets the account. */
export function resetStartedSession(): void {
  account = null;
}
