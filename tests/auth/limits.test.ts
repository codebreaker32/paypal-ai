// The limits on signing up, logging in, recovering and checking a password.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allowLogin,
  allowPasswordCheck,
  allowRecovery,
  allowSignup,
  recordLoginFailure,
  recordPasswordFailure,
  recordRecoveryFailure,
  resetRateLimits,
} from '@/lib/rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const t0 = 10_000_000;
const EMAIL = 'rosa@example.com';

const keys = () => [...(globalThis as unknown as { __shelfieRateLimits: Map<string, unknown> }).__shelfieRateLimits.keys()];

function times(n: number, fn: (i: number) => void) {
  for (let i = 0; i < n; i++) fn(i);
}

describe('auth rate limits', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv('SHELFIE_TEST', ''); // tests/setup.ts sets it, and it skips these limits
    vi.stubEnv('RENDER', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('sign-up', () => {
    it('allows 10 per address per hour', () => {
      times(10, () => expect(allowSignup('1.1.1.1', t0)).toBe(true));
      expect(allowSignup('1.1.1.1', t0)).toBe(false);
      expect(allowSignup('2.2.2.2', t0)).toBe(true);
      expect(allowSignup('1.1.1.1', t0 + HOUR)).toBe(true);
    });
  });

  describe('login', () => {
    it('allows 50 attempts per address per 15 minutes, whoever they are for', () => {
      times(50, (i) => expect(allowLogin('1.1.1.1', `user${i}@example.com`, t0)).toBe(true));
      expect(allowLogin('1.1.1.1', 'new@example.com', t0)).toBe(false);
      expect(allowLogin('2.2.2.2', 'new@example.com', t0)).toBe(true);
      expect(allowLogin('1.1.1.1', 'new@example.com', t0 + 15 * MINUTE)).toBe(true);
    });

    it('after 10 failures for one email from one address, refuses it for 15 minutes', () => {
      times(10, () => {
        expect(allowLogin('1.1.1.1', EMAIL, t0)).toBe(true);
        recordLoginFailure('1.1.1.1', EMAIL, t0);
      });
      expect(allowLogin('1.1.1.1', EMAIL, t0 + 1)).toBe(false);
      // Someone else on another address is not locked out by it, and another email is unaffected.
      expect(allowLogin('2.2.2.2', EMAIL, t0 + 1)).toBe(true);
      expect(allowLogin('1.1.1.1', 'other@example.com', t0 + 1)).toBe(true);
      expect(allowLogin('1.1.1.1', EMAIL, t0 + 15 * MINUTE)).toBe(true);
    });

    it('a successful login does not count as a failure', () => {
      times(30, (i) => expect(allowLogin('1.1.1.1', EMAIL, t0 + i)).toBe(true));
      expect(allowLogin('1.1.1.1', EMAIL, t0 + 31)).toBe(true);
    });

    it('allows 100 failures per email per hour across addresses', () => {
      times(100, (i) => recordLoginFailure(`1.1.${Math.floor(i / 250)}.${i % 250}`, EMAIL, t0));
      expect(allowLogin('2.2.2.2', EMAIL, t0 + 1)).toBe(false);
      expect(allowLogin('2.2.2.2', EMAIL, t0 + HOUR)).toBe(true);
    });

    it('counts an email the same way however it is cased or spaced', () => {
      times(10, () => recordLoginFailure('1.1.1.1', ' Rosa@Example.COM ', t0));
      expect(allowLogin('1.1.1.1', EMAIL, t0 + 1)).toBe(false);
    });

    it('counts an email that has no account the same way', () => {
      times(10, () => recordLoginFailure('1.1.1.1', 'nobody@example.com', t0));
      expect(allowLogin('1.1.1.1', 'nobody@example.com', t0 + 1)).toBe(false);
    });
  });

  describe('recovery', () => {
    it('allows 10 attempts per address per hour', () => {
      times(10, (i) => expect(allowRecovery('1.1.1.1', `user${i}@example.com`, t0)).toBe(true));
      expect(allowRecovery('1.1.1.1', 'new@example.com', t0)).toBe(false);
      expect(allowRecovery('1.1.1.1', 'new@example.com', t0 + HOUR)).toBe(true);
    });

    it('after 5 failures for one email from one address, refuses it for the hour', () => {
      times(5, () => recordRecoveryFailure('1.1.1.1', EMAIL, t0));
      expect(allowRecovery('1.1.1.1', EMAIL, t0 + 1)).toBe(false);
      expect(allowRecovery('2.2.2.2', EMAIL, t0 + 1)).toBe(true);
      expect(allowRecovery('1.1.1.1', EMAIL, t0 + HOUR)).toBe(true);
    });

    it('allows 30 failures per email per hour across addresses', () => {
      times(30, (i) => recordRecoveryFailure(`1.1.1.${i}`, EMAIL, t0));
      expect(allowRecovery('2.2.2.2', EMAIL, t0 + 1)).toBe(false);
    });

    it('login failures do not lock out recovery', () => {
      times(10, () => recordLoginFailure('1.1.1.1', EMAIL, t0));
      expect(allowLogin('1.1.1.1', EMAIL, t0 + 1)).toBe(false);
      expect(allowRecovery('1.1.1.1', EMAIL, t0 + 1)).toBe(true);
    });
  });

  describe('current-password check', () => {
    it('allows 10 failures per account per 15 minutes, and only failures count', () => {
      times(20, () => expect(allowPasswordCheck('acc_a', t0)).toBe(true));
      times(10, () => recordPasswordFailure('acc_a', t0));
      expect(allowPasswordCheck('acc_a', t0 + 1)).toBe(false);
      expect(allowPasswordCheck('acc_b', t0 + 1)).toBe(true);
      expect(allowPasswordCheck('acc_a', t0 + 15 * MINUTE)).toBe(true);
    });
  });

  it('keeps a hash in every email key, never the address itself', () => {
    allowLogin('1.1.1.1', EMAIL, t0);
    recordLoginFailure('1.1.1.1', EMAIL, t0);
    allowRecovery('1.1.1.1', EMAIL, t0);
    recordRecoveryFailure('1.1.1.1', EMAIL, t0);
    expect(keys().length).toBeGreaterThan(2);
    for (const key of keys()) expect(key).not.toContain('rosa');
  });

  describe('SHELFIE_TEST', () => {
    const exhaust = () => {
      times(60, () => {
        allowSignup('1.1.1.1', t0);
        allowLogin('1.1.1.1', EMAIL, t0);
        recordLoginFailure('1.1.1.1', EMAIL, t0);
        allowRecovery('1.1.1.1', EMAIL, t0);
        recordRecoveryFailure('1.1.1.1', EMAIL, t0);
        recordPasswordFailure('acc_a', t0);
      });
    };

    it('skips every auth limit off Render', () => {
      vi.stubEnv('SHELFIE_TEST', '1');
      exhaust();
      expect(allowSignup('1.1.1.1', t0)).toBe(true);
      expect(allowLogin('1.1.1.1', EMAIL, t0)).toBe(true);
      expect(allowRecovery('1.1.1.1', EMAIL, t0)).toBe(true);
      expect(allowPasswordCheck('acc_a', t0)).toBe(true);
    });

    it('is ignored on Render', () => {
      vi.stubEnv('SHELFIE_TEST', '1');
      vi.stubEnv('RENDER', 'true');
      exhaust();
      expect(allowSignup('1.1.1.1', t0)).toBe(false);
      expect(allowLogin('1.1.1.1', EMAIL, t0)).toBe(false);
      expect(allowRecovery('1.1.1.1', EMAIL, t0)).toBe(false);
      expect(allowPasswordCheck('acc_a', t0)).toBe(false);
    });
  });
});
