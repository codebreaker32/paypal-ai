// The one-time recovery key: no email provider exists, so this is the way back in after a forgotten password.
// 20 characters from a 32-character alphabet (100 bits), shown once; only its SHA-256 is stored.
import { randomBytes } from 'node:crypto';
import type { Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { hashToken } from '@/lib/domain/ids';
import { hashPassword } from './password';

/** No 0, O, 1 or I, which read alike on a printed card. */
export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY_LENGTH = 20;
const GROUP = 5;

/** XXXXX-XXXXX-XXXXX-XXXXX. A byte masked to 5 bits is uniform over the alphabet. */
export function generateRecoveryKey(): string {
  const chars = [...randomBytes(KEY_LENGTH)].map((b) => RECOVERY_ALPHABET[b & 31]).join('');
  return chars.match(new RegExp(`.{${GROUP}}`, 'g'))!.join('-');
}

/** A key however it was typed or pasted: without dashes or spaces, in upper case. */
export const normalizeRecoveryKey = (key: string): string => key.replace(/[-\s]/g, '').toUpperCase();

export const hashRecoveryKey = (key: string): string => hashToken(normalizeRecoveryKey(key));

export type RedeemResult = { ok: true; account: accounts.Account; recoveryKey: string } | { ok: false };

/**
 * SR12. Hashes the new password first, always, so an unknown email costs the same as a known one. The swap itself is
 * one transaction guarded by the old key's hash (`accounts.recoverAccount`), so two concurrent uses cannot both win.
 * `email` is normalised (by `parsePayeeEmail`); the password must already have passed `checkNewPassword`.
 * Throws HashBusyError when the hash gate is full.
 */
export async function redeemRecoveryKey(
  db: Db,
  input: { email: string; recoveryKey: string; newPassword: string },
): Promise<RedeemResult> {
  const passwordHash = await hashPassword(input.newPassword);
  const account = accounts.byEmail(db, input.email);
  if (!account) return { ok: false };
  const newKey = generateRecoveryKey();
  const swapped = accounts.recoverAccount(db, {
    accountId: account.id,
    expectedRecoveryHash: hashRecoveryKey(input.recoveryKey),
    passwordHash,
    newRecoveryHash: hashRecoveryKey(newKey),
  });
  return swapped ? { ok: true, account: accounts.byId(db, account.id)!, recoveryKey: newKey } : { ok: false };
}
