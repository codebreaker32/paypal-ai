// Buyer sessions from "Log in with PayPal": the token's SHA-256 and the PayPal account's emails. Nothing else.
import type { Db } from '@/lib/db';
import { now } from '@/lib/db';

export interface BuyerSessionRow {
  tokenHash: string;
  emails: string[];
  createdAt: string;
  expiresAt: string;
}

interface Row {
  token_hash: string; emails_json: string; created_at: string; expires_at: string;
}

const parseEmails = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
};

export function create(db: Db, input: { tokenHash: string; emails: string[]; expiresAt: string }): void {
  db.prepare('INSERT INTO buyer_sessions (token_hash, emails_json, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    input.tokenHash, JSON.stringify(input.emails), now(), input.expiresAt,
  );
}

export function byTokenHash(db: Db, tokenHash: string): BuyerSessionRow | null {
  const r = db.prepare('SELECT * FROM buyer_sessions WHERE token_hash = ?').get(tokenHash) as Row | undefined;
  return r ? { tokenHash: r.token_hash, emails: parseEmails(r.emails_json), createdAt: r.created_at, expiresAt: r.expires_at } : null;
}

export function deleteByTokenHash(db: Db, tokenHash: string): void {
  db.prepare('DELETE FROM buyer_sessions WHERE token_hash = ?').run(tokenHash);
}

/** Removes rows at or past their expiry (ISO-8601 UTC strings compare correctly as text). */
export function purgeExpired(db: Db, nowIso: string): void {
  db.prepare('DELETE FROM buyer_sessions WHERE expires_at <= ?').run(nowIso);
}
