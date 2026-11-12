import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import * as sessions from './sessions';

export interface Account {
  id: string;
  /** Normalised by `parsePayeeEmail` (trimmed, lower-cased). */
  email: string;
  passwordHash: string;
  /** SHA-256 hex of the current recovery key. */
  recoveryHash: string;
  /** Null until the seller has downloaded, copied or printed the key: the banner shows. */
  recoverySavedAt: string | null;
  termsVersion: string;
  termsAcceptedAt: string;
  passwordChangedAt: string;
  createdAt: string;
}

interface AccountRow {
  id: string; email: string; password_hash: string; recovery_hash: string; recovery_saved_at: string | null;
  terms_version: string; terms_accepted_at: string; password_changed_at: string; created_at: string;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id, email: r.email, passwordHash: r.password_hash, recoveryHash: r.recovery_hash,
  recoverySavedAt: r.recovery_saved_at, termsVersion: r.terms_version, termsAcceptedAt: r.terms_accepted_at,
  passwordChangedAt: r.password_changed_at, createdAt: r.created_at,
});

export interface CreateAccountInput {
  email: string;
  passwordHash: string;
  recoveryHash: string;
  termsVersion: string;
}

export function create(db: Db, input: CreateAccountInput): Account {
  const id = newId('acc');
  const at = now();
  db.prepare(
    `INSERT INTO accounts (id, email, password_hash, recovery_hash, terms_version, terms_accepted_at, password_changed_at, created_at)
     VALUES (@id, @email, @passwordHash, @recoveryHash, @termsVersion, @at, @at, @at)`,
  ).run({ ...input, id, at });
  return byId(db, id)!;
}

export function byId(db: Db, id: string): Account | null {
  const r = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  return r ? toAccount(r) : null;
}

export function byEmail(db: Db, email: string): Account | null {
  const r = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email) as AccountRow | undefined;
  return r ? toAccount(r) : null;
}

/**
 * Stores a stronger hash of the same password: not a password change, so password_changed_at stays. Pass the hash
 * that was just verified: false, and nothing written, if the row no longer holds it (recovery got there first).
 */
export function setPasswordHash(db: Db, id: string, passwordHash: string, verifiedHash?: string): boolean {
  const { changes } =
    verifiedHash === undefined
      ? db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(passwordHash, id)
      : db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ? AND password_hash = ?').run(passwordHash, id, verifiedHash);
  return changes === 1;
}

export function markRecoverySaved(db: Db, id: string): void {
  db.prepare('UPDATE accounts SET recovery_saved_at = ? WHERE id = ?').run(now(), id);
}

/**
 * A new recovery key cancels the old one; the seller has not saved the new one yet. Pass the password hash that was just
 * verified: false, and nothing written, if the row no longer holds it (a recovery ran while the password was checked).
 */
export function replaceRecoveryHash(db: Db, id: string, recoveryHash: string, verifiedPasswordHash?: string): boolean {
  const { changes } =
    verifiedPasswordHash === undefined
      ? db.prepare('UPDATE accounts SET recovery_hash = ?, recovery_saved_at = NULL WHERE id = ?').run(recoveryHash, id)
      : db
          .prepare('UPDATE accounts SET recovery_hash = ?, recovery_saved_at = NULL WHERE id = ? AND password_hash = ?')
          .run(recoveryHash, id, verifiedPasswordHash);
  return changes === 1;
}

/**
 * A seller's own password change: swaps the hash and ends every session but `keepTokenHash`, in one transaction. False,
 * and nothing changed, if the row no longer holds the hash that was just verified.
 */
export function changePassword(db: Db, id: string, passwordHash: string, verifiedHash: string, keepTokenHash: string): boolean {
  return db.transaction(() => {
    const { changes } = db
      .prepare('UPDATE accounts SET password_hash = ?, password_changed_at = ? WHERE id = ? AND password_hash = ?')
      .run(passwordHash, now(), id, verifiedHash);
    if (changes !== 1) return false;
    sessions.deleteOthersForAccount(db, id, keepTokenHash);
    return true;
  })();
}

/** Deletes the account row; its sessions cascade. Delete its shops first (`shops.account_id` has no cascade). */
export function deleteRow(db: Db, id: string): void {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

export interface RecoverAccountInput {
  accountId: string;
  /** The hash of the key the seller typed; the row must still hold it. */
  expectedRecoveryHash: string;
  passwordHash: string;
  newRecoveryHash: string;
}

/**
 * Swaps the password and the recovery key and ends every session, in one transaction. The WHERE clause on the old
 * key means that of two concurrent uses exactly one changes the row. False (and nothing changed) when the key is not
 * the current one.
 */
export function recoverAccount(db: Db, input: RecoverAccountInput): boolean {
  return db.transaction(() => {
    const { changes } = db
      .prepare(
        `UPDATE accounts SET password_hash = ?, recovery_hash = ?, recovery_saved_at = NULL, password_changed_at = ?
         WHERE id = ? AND recovery_hash = ?`,
      )
      .run(input.passwordHash, input.newRecoveryHash, now(), input.accountId, input.expectedRecoveryHash);
    if (changes !== 1) return false;
    sessions.deleteForAccount(db, input.accountId);
    return true;
  })();
}
