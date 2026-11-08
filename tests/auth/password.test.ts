// Password storage (SR5), the rules for a new password (SR6) and the global hash gate (SR7).
import type * as Crypto from 'node:crypto';
import { randomBytes, scryptSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

type ScryptCallback = (err: Error | null, key: Buffer) => void;
const stub = vi.hoisted(() => ({
  scrypt: null as null | ((password: string, salt: Buffer, keylen: number, options: object, cb: ScryptCallback) => void),
}));

// Real scrypt unless a test installs a stub: the gate is asserted on the scrypt calls themselves.
vi.mock('node:crypto', async (orig) => {
  const real = await orig<typeof Crypto>();
  const scrypt = (...args: unknown[]) =>
    stub.scrypt ? (stub.scrypt as (...a: unknown[]) => void)(...args) : (real.scrypt as (...a: unknown[]) => void)(...args);
  return { ...real, default: { ...real, scrypt }, scrypt };
});

const {
  HashBusyError,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  busyResponse,
  checkNewPassword,
  dummyVerify,
  hashPassword,
  needsRehash,
  verifyPassword,
} = await import('@/lib/auth/password');
const { COMMON_PASSWORDS } = await import('@/lib/auth/common-passwords');

const PHRASE = 'the bakery smells of rain';
const EMAIL = 'rosa@example.com';

afterEach(() => {
  stub.scrypt = null;
});

describe('SR5: storing a password', () => {
  it('stores scrypt$32768$8$3$ with a 16-byte salt and a 32-byte key in base64url', async () => {
    const stored = await hashPassword(PHRASE);
    const m = /^scrypt\$32768\$8\$3\$([\w-]+)\$([\w-]+)$/.exec(stored);
    expect(m).not.toBeNull();
    expect(Buffer.from(m![1], 'base64url')).toHaveLength(16);
    expect(Buffer.from(m![2], 'base64url')).toHaveLength(32);
  });

  it('salts: the same password stores differently each time', async () => {
    expect(await hashPassword(PHRASE)).not.toBe(await hashPassword(PHRASE));
  });

  it('verifies the right password and refuses a wrong one', async () => {
    const stored = await hashPassword(PHRASE);
    expect(await verifyPassword(PHRASE, stored)).toBe(true);
    expect(await verifyPassword(`${PHRASE}x`, stored)).toBe(false);
  });

  it('sets the memory limit itself, enough for these parameters', async () => {
    const seen: object[] = [];
    stub.scrypt = (_p, _s, keylen, options, cb) => {
      seen.push(options);
      cb(null, Buffer.alloc(keylen));
    };
    await hashPassword(PHRASE);
    expect(seen).toEqual([{ N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }]);
  });

  it('a stored hash made with other parameters still verifies, and asks to be rehashed', async () => {
    const salt = randomBytes(16);
    const key = scryptSync(PHRASE, salt, 32, { N: 16384, r: 8, p: 1 });
    const old = `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
    expect(await verifyPassword(PHRASE, old)).toBe(true);
    expect(await verifyPassword('not the password at all', old)).toBe(false);
    expect(needsRehash(old)).toBe(true);
  });

  it('a hash with the current parameters does not ask to be rehashed', async () => {
    expect(needsRehash(await hashPassword(PHRASE))).toBe(false);
  });

  it('a malformed stored value verifies as false, without throwing or running scrypt', async () => {
    stub.scrypt = () => {
      throw new Error('should not run');
    };
    for (const bad of ['', 'nonsense', 'scrypt$x$8$3$a$b', 'scrypt$32768$8$3$$', 'bcrypt$32768$8$3$YWJj$YWJj', 'scrypt$0$8$3$YWJj$YWJj']) {
      expect(await verifyPassword(PHRASE, bad)).toBe(false);
      expect(needsRehash(bad)).toBe(true);
    }
  });

  it('a stored value with an empty or tiny key or salt never verifies (an empty key would match anything)', async () => {
    stub.scrypt = (_p, _s, keylen, _o, cb) => cb(null, Buffer.alloc(keylen));
    const good = Buffer.alloc(32).toString('base64url');
    const tiny = Buffer.alloc(8).toString('base64url');
    expect(await verifyPassword(PHRASE, ['scrypt', 32768, 8, 3, good, 'a'].join('$'))).toBe(false); // 'a' decodes to zero bytes
    expect(await verifyPassword(PHRASE, ['scrypt', 32768, 8, 3, 'a', good].join('$'))).toBe(false);
    expect(await verifyPassword(PHRASE, ['scrypt', 32768, 8, 3, good, tiny].join('$'))).toBe(false);
  });

  it('a stored hash whose parameters would exceed the memory limit verifies as false', async () => {
    const salt = Buffer.alloc(16).toString('base64url');
    const key = Buffer.alloc(32).toString('base64url');
    expect(await verifyPassword(PHRASE, `scrypt$1048576$8$3$${salt}$${key}`)).toBe(false);
  });
});

describe('SR6: the rules for a new password', () => {
  const ok = (p: unknown) => checkNewPassword(p, EMAIL).ok;
  const problem = (p: unknown, email = EMAIL) => {
    const r = checkNewPassword(p, email);
    return r.ok ? null : r.problem;
  };

  it('allows 15 to 128 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(15);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
    expect(problem('abcdefghijklm n')).toBeNull(); // 15, lower case and one space
    expect('abcdefghijklm n').toHaveLength(15);
    expect(problem('ab'.repeat(64))).toBeNull(); // 128
    expect(problem('abcdefghijklmn')).toBe('too_short'); // 14
    expect(problem(`${'ab'.repeat(64)}x`)).toBe('too_long'); // 129
  });

  it('has no composition rules: a lower-case phrase passes', () => {
    expect(ok('sourdough on the windowsill')).toBe(true);
  });

  it('counts characters, not UTF-16 units: 15 emoji are long enough, 14 are not', () => {
    const emoji = ['🥐', '🍞', '🥖', '🥨', '🥯', '🧁', '🍰', '🎂', '🍪', '🍩', '🍫', '🍬', '🍭', '🍮', '🍯'];
    expect(problem(emoji.join(''))).toBeNull();
    expect(problem(emoji.slice(0, 14).join(''))).toBe('too_short');
  });

  it('refuses a blocklisted password in any case', () => {
    expect(problem('passwordpassword')).toBe('common');
    expect(problem('PasswordPassWord')).toBe('common');
    expect(problem('correct horse battery staple')).toBe('common');
  });

  it('refuses one character repeated, including one above the BMP', () => {
    expect(problem('a'.repeat(15))).toBe('repeated');
    expect(problem('🥐'.repeat(15))).toBe('repeated');
  });

  it("refuses the account's own email in any case", () => {
    const long = 'rosa.the.baker@example.com';
    expect(problem('Rosa.The.Baker@Example.COM', long)).toBe('email');
    expect(problem('rosa.the.baker@example.com ', long)).toBeNull(); // not the same string
  });

  it('refuses anything that is not a string as too short', () => {
    expect(problem(undefined)).toBe('too_short');
    expect(problem(12345678901234567890)).toBe('too_short');
  });

  it('gives a plain message for each problem, with the exact words from the sign-up screen', () => {
    const msg = (p: string, email = EMAIL) => {
      const r = checkNewPassword(p, email);
      return r.ok ? null : r.message;
    };
    expect(msg('short')).toBe('Use at least 15 characters.');
    expect(msg('passwordpassword')).toBe('That password is too common. Try a short sentence only you would say.');
    expect(msg('a'.repeat(15))).toBe('That password is too common. Try a short sentence only you would say.');
    expect(msg('rosa.the.baker@example.com', 'rosa.the.baker@example.com')).toBe(
      'Your password can’t be your email. Try a short sentence only you would say.',
    );
    expect(msg('ab'.repeat(65))).toBe('Use 128 characters or fewer.');
  });

  describe('the blocklist', () => {
    it('holds at least 200 unique lower-case entries of 15 or more characters', () => {
      expect(COMMON_PASSWORDS.length).toBeGreaterThanOrEqual(200);
      expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
      for (const p of COMMON_PASSWORDS) {
        expect(p.length, p).toBeGreaterThanOrEqual(15);
        expect(p, p).toBe(p.toLowerCase());
      }
    });
  });
});

describe('SR7: the global hash gate', () => {
  /** Holds every scrypt call open until the test releases it. */
  function holdScrypt() {
    const calls: { finish: (err?: Error) => void }[] = [];
    stub.scrypt = (_p, _s, keylen, _o, cb) => {
      calls.push({ finish: (err) => cb(err ?? null, Buffer.alloc(keylen)) });
    };
    return calls;
  }

  it('runs 2 at once, queues 8 more, refuses the 11th as busy', async () => {
    const calls = holdScrypt();
    const started = Array.from({ length: 10 }, () => hashPassword(PHRASE));
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    await expect(hashPassword(PHRASE)).rejects.toBeInstanceOf(HashBusyError);
    expect(calls).toHaveLength(2); // the refused one never reached scrypt

    // Finishing work lets the queue through, never more than two at once.
    for (let finished = 0; finished < 10; finished++) {
      calls[finished].finish();
      await vi.waitFor(() => expect(calls).toHaveLength(Math.min(finished + 3, 10)));
    }
    await expect(Promise.all(started)).resolves.toHaveLength(10);
  });

  it('frees the slot when scrypt fails', async () => {
    const calls = holdScrypt();
    const first = hashPassword(PHRASE);
    const second = hashPassword(PHRASE);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    calls[0].finish(new Error('out of memory'));
    calls[1].finish();
    await expect(first).rejects.toThrow('out of memory');
    await expect(second).resolves.toMatch(/^scrypt\$/);

    const third = hashPassword(PHRASE);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    calls[2].finish();
    await expect(third).resolves.toMatch(/^scrypt\$/);
  });

  it('covers verifyPassword and dummyVerify too', async () => {
    const stored = await hashPassword(PHRASE); // real scrypt, before the stub
    const calls = holdScrypt();
    const running = [verifyPassword(PHRASE, stored), dummyVerify(PHRASE)];
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    const queued = Array.from({ length: 8 }, () => hashPassword(PHRASE));
    await expect(verifyPassword(PHRASE, stored)).rejects.toBeInstanceOf(HashBusyError);
    await expect(dummyVerify(PHRASE)).rejects.toBeInstanceOf(HashBusyError);

    for (let finished = 0; finished < 10; finished++) {
      calls[finished].finish();
      await vi.waitFor(() => expect(calls).toHaveLength(Math.min(finished + 3, 10)));
    }
    await Promise.all([...running, ...queued]);
  });

  it('dummyVerify does the same scrypt work as checking a real password', async () => {
    const seen: object[] = [];
    stub.scrypt = (_p, _s, keylen, options, cb) => {
      seen.push(options);
      cb(null, Buffer.alloc(keylen));
    };
    await dummyVerify(PHRASE);
    expect(seen).toEqual([{ N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }]);
  });

  it('the busy response is 503 BUSY with Retry-After and no-store', async () => {
    const res = busyResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toMatch(/^[1-9]\d*$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: { code: 'BUSY', message: 'Shelfie is busy. Try again in a few seconds.' } });
  });
});
