// Plain-function repos for accounts and sessions.
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as sessions from '@/lib/db/repos/sessions';

const input = (email = 'rosa@example.com') => ({
  email,
  passwordHash: 'scrypt$hash',
  recoveryHash: 'recovery-hash',
  termsVersion: '2026-11-08',
});

describe('accounts repo', () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates an account with an acc_ id and today\'s timestamps, recovery key not yet saved', () => {
    const a = accounts.create(db, input());
    expect(a.id).toMatch(/^acc_[a-z2-7]{16}$/);
    expect(a).toMatchObject({
      email: 'rosa@example.com',
      passwordHash: 'scrypt$hash',
      recoveryHash: 'recovery-hash',
      recoverySavedAt: null,
      termsVersion: '2026-11-08',
    });
    expect(Date.parse(a.termsAcceptedAt)).not.toBeNaN();
    expect(a.passwordChangedAt).toBe(a.createdAt);
  });

  it('finds an account by id and by email, and null otherwise', () => {
    const a = accounts.create(db, input());
    expect(accounts.byId(db, a.id)?.email).toBe('rosa@example.com');
    expect(accounts.byEmail(db, 'rosa@example.com')?.id).toBe(a.id);
    expect(accounts.byId(db, 'acc_none')).toBeNull();
    expect(accounts.byEmail(db, 'nobody@example.com')).toBeNull();
  });

  it('refuses a second account with the same email', () => {
    accounts.create(db, input());
    expect(() => accounts.create(db, input())).toThrow(/UNIQUE/);
  });

  it('updating the stored hash (a rehash) leaves password_changed_at alone', () => {
    const a = accounts.create(db, input());
    db.prepare(`UPDATE accounts SET password_changed_at = '2020-01-01T00:00:00.000Z' WHERE id = ?`).run(a.id);
    accounts.setPasswordHash(db, a.id, 'scrypt$new');
    expect(accounts.byId(db, a.id)).toMatchObject({ passwordHash: 'scrypt$new', passwordChangedAt: '2020-01-01T00:00:00.000Z' });
  });

  it('marks the recovery key saved, and a replacement key clears that again', () => {
    const a = accounts.create(db, input());
    accounts.markRecoverySaved(db, a.id);
    expect(accounts.byId(db, a.id)?.recoverySavedAt).not.toBeNull();
    accounts.replaceRecoveryHash(db, a.id, 'next-hash');
    expect(accounts.byId(db, a.id)).toMatchObject({ recoveryHash: 'next-hash', recoverySavedAt: null });
  });

  describe('recoverAccount (one transaction, compare-and-set on the old key)', () => {
    const swap = (id: string, expected = 'recovery-hash') => ({
      accountId: id,
      expectedRecoveryHash: expected,
      passwordHash: 'scrypt$after',
      newRecoveryHash: 'recovery-after',
    });

    it('with the current key: swaps password and key, marks the new key unsaved, ends every session of that account only', () => {
      const a = accounts.create(db, input());
      accounts.markRecoverySaved(db, a.id);
      const other = accounts.create(db, input('other@example.com'));
      sessions.create(db, { tokenHash: 'one', accountId: a.id, expiresAt: '2030-01-01T00:00:00.000Z' });
      sessions.create(db, { tokenHash: 'two', accountId: a.id, expiresAt: '2030-01-01T00:00:00.000Z' });
      sessions.create(db, { tokenHash: 'theirs', accountId: other.id, expiresAt: '2030-01-01T00:00:00.000Z' });

      expect(accounts.recoverAccount(db, swap(a.id))).toBe(true);

      expect(accounts.byId(db, a.id)).toMatchObject({
        passwordHash: 'scrypt$after',
        recoveryHash: 'recovery-after',
        recoverySavedAt: null,
      });
      expect(sessions.byTokenHash(db, 'one')).toBeNull();
      expect(sessions.byTokenHash(db, 'two')).toBeNull();
      expect(sessions.byTokenHash(db, 'theirs')).not.toBeNull();
    });

    it('sets password_changed_at', () => {
      const a = accounts.create(db, input());
      db.prepare(`UPDATE accounts SET password_changed_at = '2020-01-01T00:00:00.000Z' WHERE id = ?`).run(a.id);
      accounts.recoverAccount(db, swap(a.id));
      expect(accounts.byId(db, a.id)?.passwordChangedAt).not.toBe('2020-01-01T00:00:00.000Z');
    });

    it('with a stale key: changes nothing and ends no sessions', () => {
      const a = accounts.create(db, input());
      sessions.create(db, { tokenHash: 'one', accountId: a.id, expiresAt: '2030-01-01T00:00:00.000Z' });
      expect(accounts.recoverAccount(db, swap(a.id, 'wrong'))).toBe(false);
      expect(accounts.byId(db, a.id)).toMatchObject({ passwordHash: 'scrypt$hash', recoveryHash: 'recovery-hash' });
      expect(sessions.byTokenHash(db, 'one')).not.toBeNull();
    });

    it('a second use of the same key fails', () => {
      const a = accounts.create(db, input());
      expect(accounts.recoverAccount(db, swap(a.id))).toBe(true);
      expect(accounts.recoverAccount(db, swap(a.id))).toBe(false);
    });
  });
});

describe('sessions repo', () => {
  let db: Db;
  let accountId: string;
  beforeEach(() => {
    db = createTestDb();
    accountId = accounts.create(db, input()).id;
  });

  it('stores a session and finds it by its token hash', () => {
    sessions.create(db, { tokenHash: 'h', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    const row = sessions.byTokenHash(db, 'h');
    expect(row).toMatchObject({ tokenHash: 'h', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(Date.parse(row!.createdAt)).not.toBeNaN();
    expect(sessions.byTokenHash(db, 'missing')).toBeNull();
  });

  it('deletes one session by its hash', () => {
    sessions.create(db, { tokenHash: 'a', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.create(db, { tokenHash: 'b', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.deleteByTokenHash(db, 'a');
    expect(sessions.byTokenHash(db, 'a')).toBeNull();
    expect(sessions.byTokenHash(db, 'b')).not.toBeNull();
  });

  it('deletes every session of one account', () => {
    sessions.create(db, { tokenHash: 'a', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.create(db, { tokenHash: 'b', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.deleteForAccount(db, accountId);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
  });

  it('purges rows at or past their expiry and keeps the rest', () => {
    sessions.create(db, { tokenHash: 'old', accountId, expiresAt: '2026-01-01T00:00:00.000Z' });
    sessions.create(db, { tokenHash: 'edge', accountId, expiresAt: '2026-06-01T00:00:00.000Z' });
    sessions.create(db, { tokenHash: 'live', accountId, expiresAt: '2030-01-01T00:00:00.000Z' });
    sessions.purgeExpired(db, '2026-06-01T00:00:00.000Z');
    expect(sessions.byTokenHash(db, 'old')).toBeNull();
    expect(sessions.byTokenHash(db, 'edge')).toBeNull();
    expect(sessions.byTokenHash(db, 'live')).not.toBeNull();
  });
});
