// Auth rate limits under concurrency: a failure is reserved before the hash and handed back on success, so a burst cannot run more
// guesses than the limit. The current-password check also counts attempts, because a correct password buys hash work too.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SHOPS_PER_ACCOUNT } from '@/lib/catalog/setup';
import { AUTH_RATES, reserveLogin, reservePasswordCheck, reserveRecovery, resetRateLimits } from '@/lib/rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const t0 = 10_000_000;
const EMAIL = 'rosa@example.com';
const IP = '1.1.1.1';

function times(n: number, fn: (i: number) => void) {
  for (let i = 0; i < n; i++) fn(i);
}

describe('reserving a failure before the hash', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv('SHELFIE_TEST', '');
    vi.stubEnv('RENDER', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('reserveLogin', () => {
    it('admits 10 guesses for one email from one address while none has finished', () => {
      times(10, () => expect(reserveLogin(IP, EMAIL, t0)).not.toBeNull());
      expect(reserveLogin(IP, EMAIL, t0)).toBeNull();
      expect(reserveLogin('2.2.2.2', EMAIL, t0)).not.toBeNull();
    });

    it('gives the failure back on success, so successful logins do not count', () => {
      times(30, (i) => {
        const release = reserveLogin(IP, EMAIL, t0 + i);
        expect(release).not.toBeNull();
        release!();
      });
      expect(reserveLogin(IP, EMAIL, t0 + 31)).not.toBeNull();
    });

    it('releasing twice hands back only one failure', () => {
      times(9, () => reserveLogin(IP, EMAIL, t0));
      const release = reserveLogin(IP, EMAIL, t0)!;
      release();
      release();
      expect(reserveLogin(IP, EMAIL, t0)).not.toBeNull();
      expect(reserveLogin(IP, EMAIL, t0)).toBeNull();
    });

    it('a released attempt still counts against the address', () => {
      times(50, (i) => reserveLogin(IP, `user${i}@example.com`, t0)!());
      expect(reserveLogin(IP, 'new@example.com', t0)).toBeNull();
    });

    it('a kept failure expires with its window', () => {
      times(10, () => reserveLogin(IP, EMAIL, t0));
      expect(reserveLogin(IP, EMAIL, t0 + 15 * MINUTE)).not.toBeNull();
    });

    it('a release after the window has passed changes nothing', () => {
      const old = reserveLogin(IP, EMAIL, t0)!;
      times(9, () => reserveLogin(IP, EMAIL, t0 + 15 * MINUTE));
      old();
      expect(reserveLogin(IP, EMAIL, t0 + 15 * MINUTE)).not.toBeNull();
      expect(reserveLogin(IP, EMAIL, t0 + 15 * MINUTE)).toBeNull();
    });

    it('caps failures per email across addresses at 100', () => {
      times(100, (i) => expect(reserveLogin(`3.3.${Math.floor(i / 250)}.${i % 250}`, EMAIL, t0)).not.toBeNull());
      expect(reserveLogin('2.2.2.2', EMAIL, t0)).toBeNull();
    });
  });

  describe('reserveRecovery', () => {
    it('admits 5 guesses for one email from one address while none has finished', () => {
      times(5, () => expect(reserveRecovery(IP, EMAIL, t0)).not.toBeNull());
      expect(reserveRecovery(IP, EMAIL, t0)).toBeNull();
    });

    it('gives the failure back on success', () => {
      times(5, () => reserveRecovery(IP, EMAIL, t0)!());
      expect(reserveRecovery(IP, EMAIL, t0)).not.toBeNull();
    });

    it('stays open after 10 reserved login failures', () => {
      times(10, () => reserveLogin(IP, EMAIL, t0));
      expect(reserveLogin(IP, EMAIL, t0)).toBeNull();
      expect(reserveRecovery(IP, EMAIL, t0)).not.toBeNull();
    });
  });

  describe('reservePasswordCheck', () => {
    it('admits 10 wrong guesses per account while none has finished, then refuses', () => {
      times(10, () => expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull());
      expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull();
      expect(reservePasswordCheck('acc_b', IP, t0)).not.toBeNull();
    });

    it('counts a correct password as an attempt: 30 per account per hour', () => {
      times(30, () => reservePasswordCheck('acc_a', IP, t0)!());
      expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull();
      expect(reservePasswordCheck('acc_a', IP, t0 + HOUR)).not.toBeNull();
    });

    it('counts 30 attempts per address per hour across accounts', () => {
      times(30, (i) => expect(reservePasswordCheck(`acc_${i % 5}`, IP, t0)).not.toBeNull());
      expect(reservePasswordCheck('acc_new', IP, t0)).toBeNull();
      expect(reservePasswordCheck('acc_new', '2.2.2.2', t0)).not.toBeNull();
      expect(reservePasswordCheck('acc_new', IP, t0 + HOUR)).not.toBeNull();
    });

    it('a request refused by the address limit charges the account nothing', () => {
      times(30, (i) => reservePasswordCheck(`acc_${i % 5}`, IP, t0)!());
      expect(reservePasswordCheck('acc_x', IP, t0)).toBeNull();
      times(10, () => expect(reservePasswordCheck('acc_x', '2.2.2.2', t0)).not.toBeNull());
    });

    it('a request refused by the account limit charges the address nothing', () => {
      times(30, () => reservePasswordCheck('acc_a', '9.9.9.9', t0)!());
      times(5, () => expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull());
      times(29, (i) => expect(reservePasswordCheck(`acc_${i}`, IP, t0)).not.toBeNull());
      expect(reservePasswordCheck('acc_b', IP, t0)).not.toBeNull();
    });

    it('leaves room for one password per shop on the largest account, from one address', () => {
      expect(AUTH_RATES.passwordAttemptsAccount.limit).toBeGreaterThan(MAX_SHOPS_PER_ACCOUNT);
      expect(AUTH_RATES.passwordAttemptsIp.limit).toBeGreaterThan(MAX_SHOPS_PER_ACCOUNT);
      times(MAX_SHOPS_PER_ACCOUNT, () => expect(reservePasswordCheck('acc_a', IP, t0)?.()).toBeUndefined());
      expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull();
    });

    describe('notChecked: the hash never ran', () => {
      it('hands back the attempts on the account and the address, and the failure', () => {
        times(100, () => reservePasswordCheck('acc_a', IP, t0)!.notChecked());
        times(10, () => expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull());
        expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull();
      });

      it('a second call hands back nothing more', () => {
        times(29, () => reservePasswordCheck('acc_a', IP, t0)!());
        const reserved = reservePasswordCheck('acc_a', IP, t0)!;
        reserved.notChecked();
        reserved.notChecked();
        expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull();
        expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull();
      });

      it('after a right password it still gives the attempts back, once, and the failure only once', () => {
        times(9, () => reservePasswordCheck('acc_a', IP, t0));
        const reserved = reservePasswordCheck('acc_a', IP, t0)!;
        reserved();
        reserved.notChecked();
        expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull();
        expect(reservePasswordCheck('acc_a', IP, t0)).toBeNull();
      });

      it('does nothing after the window has passed', () => {
        const old = reservePasswordCheck('acc_a', IP, t0)!;
        times(29, () => reservePasswordCheck('acc_a', IP, t0 + HOUR)!());
        old.notChecked();
        expect(reservePasswordCheck('acc_a', IP, t0 + HOUR)).not.toBeNull();
        expect(reservePasswordCheck('acc_a', IP, t0 + HOUR)).toBeNull();
      });

      it('is safe when the limits are skipped', () => {
        vi.stubEnv('SHELFIE_TEST', '1');
        expect(() => reservePasswordCheck('acc_a', IP, t0)!.notChecked()).not.toThrow();
      });
    });
  });

  describe('SHELFIE_TEST', () => {
    it('skips every reservation off Render', () => {
      vi.stubEnv('SHELFIE_TEST', '1');
      times(60, () => {
        expect(reserveLogin(IP, EMAIL, t0)).not.toBeNull();
        expect(reserveRecovery(IP, EMAIL, t0)).not.toBeNull();
        expect(reservePasswordCheck('acc_a', IP, t0)).not.toBeNull();
      });
    });

    it('is ignored on Render', () => {
      vi.stubEnv('SHELFIE_TEST', '1');
      vi.stubEnv('RENDER', 'true');
      times(10, () => reserveLogin(IP, EMAIL, t0));
      expect(reserveLogin(IP, EMAIL, t0)).toBeNull();
    });
  });
});
