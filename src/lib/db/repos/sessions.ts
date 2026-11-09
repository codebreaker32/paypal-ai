import type { Db } from '@/lib/db';
import { now } from '@/lib/db';

export interface SessionRow {
  /** SHA-256 hex of the cookie value; the raw token is never stored. */
  tokenHash: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
}

interface Row {
  token_hash: string; account_id: string; created_at: string; expires_at: string;
}

const toSession = (r: Row): SessionRow => ({
  tokenHash: r.token_hash, accountId: r.account_id, createdAt: r.created_at, expiresAt: r.expires_at,
});

export function create(db: Db, input: { tokenHash: string; accountId: string; expiresAt: string }): void {
  db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    input.tokenHash, input.accountId, now(), input.expiresAt,
  );
}

export function byTokenHash(db: Db, tokenHash: string): SessionRow | null {
  const r = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as Row | undefined;
  return r ? toSession(r) : null;
}

export function deleteByTokenHash(db: Db, tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteForAccount(db: Db, accountId: string): void {
  db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
}

/** Logs out the account's other devices: every session but the one with this token hash. */
export function deleteOthersForAccount(db: Db, accountId: string, keepTokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash <> ?').run(accountId, keepTokenHash);
}

/** Removes rows at or past their expiry. `nowIso` is an ISO-8601 UTC string, which compares correctly as text. */
export function purgeExpired(db: Db, nowIso: string): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso);
}
