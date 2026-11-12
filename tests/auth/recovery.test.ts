// The one-time recovery key: shape, stored hash, and the atomic swap when it is used.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as sessions from '@/lib/db/repos/sessions';

vi.mock('@/lib/auth/password', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/password')>();
  return { ...real, hashPassword: vi.fn(real.hashPassword) };
});

const { hashPassword, verifyPassword } = await import('@/lib/auth/password');
const { RECOVERY_ALPHABET, generateRecoveryKey, hashRecoveryKey, normalizeRecoveryKey, redeemRecoveryKey } = await import(
  '@/lib/auth/recovery'
);

const NEW_PASSWORD = 'a new sentence for the shop';

describe('the recovery key', () => {
  it('has a 32-character alphabet (5 bits per character) with no look-alike characters', () => {
    expect(new Set(RECOVERY_ALPHABET).size).toBe(32);
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    expect(RECOVERY_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('prints as XXXXX-XXXXX-XXXXX-XXXXX, 20 alphabet characters (100 bits)', () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    const chars = key.replaceAll('-', '');
    expect(chars).toHaveLength(20);
    for (const c of chars) expect(RECOVERY_ALPHABET).toContain(c);
  });

  it('is different every time', () => {
    const keys = new Set(Array.from({ length: 200 }, generateRecoveryKey));
    expect(keys.size).toBe(200);
  });

  it('compares after removing dashes and upper-casing', () => {
    expect(normalizeRecoveryKey('abcde-fghjk-lmnpq-rstuv')).toBe('ABCDEFGHJKLMNPQRSTUV');
    expect(normalizeRecoveryKey('ABCDE FGHJK\nLMNPQ-RSTUV ')).toBe('ABCDEFGHJKLMNPQRSTUV');
  });

  it('stores SHA-256 hex of the normalised key, the same for any way of typing it', () => {
    const expected = createHash('sha256').update('ABCDEFGHJKLMNPQRSTUV').digest('hex');
    expect(hashRecoveryKey('abcde-fghjk-lmnpq-rstuv')).toBe(expected);
    expect(hashRecoveryKey('ABCDEFGHJKLMNPQRSTUV')).toBe(expected);
  });
});

describe('redeemRecoveryKey', () => {
  let db: Db;
  let accountId: string;
  let key: string;

  beforeEach(() => {
    vi.mocked(hashPassword).mockClear();
    db = createTestDb();
    key = generateRecoveryKey();
    accountId = accounts.create(db, {
      email: 'rosa@example.com',
      passwordHash: 'scrypt$before',
      recoveryHash: hashRecoveryKey(key),
      termsVersion: 'v1',
    }).id;
    accounts.markRecoverySaved(db, accountId);
    sessions.create(db, { tokenHash: 'phone', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.create(db, { tokenHash: 'laptop', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
  });

  const use = (recoveryKey = key, email = 'rosa@example.com') => redeemRecoveryKey(db, { email, recoveryKey, newPassword: NEW_PASSWORD });

  it('replaces the password and the key, and ends every session', async () => {
    const result = await use();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account.id).toBe(accountId);
    expect(result.recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect(result.recoveryKey).not.toBe(key);

    const stored = accounts.byId(db, accountId)!;
    expect(await verifyPassword(NEW_PASSWORD, stored.passwordHash)).toBe(true);
    expect(stored.recoveryHash).toBe(hashRecoveryKey(result.recoveryKey));
    expect(stored.recoverySavedAt).toBeNull();
    expect(sessions.byTokenHash(db, 'phone')).toBeNull();
    expect(sessions.byTokenHash(db, 'laptop')).toBeNull();
  });

  it('accepts the key however it was typed', async () => {
    expect((await use(key.toLowerCase().replaceAll('-', ''))).ok).toBe(true);
  });

  it('refuses a used key: it is replaced on use', async () => {
    expect((await use()).ok).toBe(true);
    expect(await use()).toEqual({ ok: false });
  });

  it('on a wrong key changes nothing and ends no sessions, but still hashes', async () => {
    expect(await use('AAAAA-AAAAA-AAAAA-AAAAA')).toEqual({ ok: false });
    const stored = accounts.byId(db, accountId)!;
    expect(stored.passwordHash).toBe('scrypt$before');
    expect(stored.recoveryHash).toBe(hashRecoveryKey(key));
    expect(stored.recoverySavedAt).not.toBeNull();
    expect(sessions.byTokenHash(db, 'phone')).not.toBeNull();
    expect(hashPassword).toHaveBeenCalledTimes(1);
  });

  it('hashes even for an unknown email, so the two cases cost the same', async () => {
    expect(await use(key, 'nobody@example.com')).toEqual({ ok: false });
    expect(hashPassword).toHaveBeenCalledTimes(1);
  });

  it('of two concurrent uses of one key, exactly one succeeds', async () => {
    const results = await Promise.all([use(), use()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false }]);
    const winner = results.find((r) => r.ok) as { ok: true; recoveryKey: string };
    expect(accounts.byId(db, accountId)!.recoveryHash).toBe(hashRecoveryKey(winner.recoveryKey));
  });

  it('never stores the raw key', async () => {
    const result = await use();
    if (!result.ok) throw new Error('recovery failed');
    const everything = JSON.stringify(db.prepare('SELECT * FROM accounts').all());
    expect(everything).not.toContain(result.recoveryKey);
    expect(everything).not.toContain(result.recoveryKey.replaceAll('-', ''));
  });
});
