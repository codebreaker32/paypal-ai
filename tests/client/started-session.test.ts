import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceSession, resetStartedSession, startedAccount, subscribeStartedSession } from '@/lib/client/started-session';

describe('started session', () => {
  afterEach(() => resetStartedSession());

  it('holds no account until a session starts in this tab', () => {
    expect(startedAccount()).toBeNull();
  });

  it('holds the account and tells subscribers once a session starts', () => {
    const listener = vi.fn();
    const stop = subscribeStartedSession(listener);
    announceSession('rosa@example.com');
    expect(startedAccount()).toEqual({ email: 'rosa@example.com' });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('returns the same object between reads, as useSyncExternalStore needs', () => {
    announceSession('rosa@example.com');
    expect(startedAccount()).toBe(startedAccount());
  });
});
